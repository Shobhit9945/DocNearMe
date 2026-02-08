import CryptoKit
import Foundation
import CryptoSwift

enum MedicalVault {
    static let keyDerivationSaltBytes = 16
    static let keyDerivationIvBytes = 12
    static let dekBytes = 32
    static let defaultAead = "aes-256-gcm"

    static let defaultKdfParams = VaultKdfParams(
        algo: "scrypt",
        N: 1 << 15,
        r: 8,
        p: 1,
        keyLen: 32,
        iterations: nil,
        hash: nil,
        opslimit: nil,
        memlimit: nil
    )

    struct WrappedDek {
        let wrappedKey: String
        let kdfSalt: String
        let kdfParams: VaultKdfParams
        let wrapIv: String
        let aead: String
    }

    static func generateRecoveryKey() -> String {
        var bytes = [UInt8](repeating: 0, count: dekBytes)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let data = Data(bytes)
        return base64UrlEncode(data)
    }

    static func storeLocalVaultKey(email: String?, key: SymmetricKey) {
        let keyData = key.withUnsafeBytes { Data($0) }
        let account = keyStorageKey(email: email)
        _ = KeychainStore.save(keyData, account: account)
    }

    static func getStoredVaultKey(email: String?) -> SymmetricKey? {
        let account = keyStorageKey(email: email)
        guard let data = KeychainStore.load(account: account) else { return nil }
        return SymmetricKey(data: data)
    }

    static func clearLocalVaultKey(email: String?) {
        let account = keyStorageKey(email: email)
        KeychainStore.delete(account: account)
    }

    static func keyStorageKey(email: String?) -> String {
        let normalized = (email ?? "unknown").lowercased()
        return "docnearme_medical_records_dek_\(normalized)"
    }

    static func wrapDEK(_ dek: SymmetricKey, secret: String, kdfParams: VaultKdfParams = defaultKdfParams) throws -> WrappedDek {
        let salt = randomBytes(count: keyDerivationSaltBytes)
        let iv = randomBytes(count: keyDerivationIvBytes)
        let kek = try deriveKey(secret: secret, salt: salt, params: kdfParams)
        let rawKey = dek.withUnsafeBytes { Data($0) }
        let sealed = try AES.GCM.seal(rawKey, using: kek, nonce: AES.GCM.Nonce(data: iv))
        let ciphertext = sealed.ciphertext + sealed.tag

        return WrappedDek(
            wrappedKey: base64Encode(ciphertext),
            kdfSalt: base64Encode(salt),
            kdfParams: kdfParams,
            wrapIv: base64Encode(iv),
            aead: defaultAead
        )
    }

    static func unwrapDEK(payload: WrappedDek, secret: String) throws -> SymmetricKey {
        let salt = base64Decode(payload.kdfSalt)
        let iv = base64Decode(payload.wrapIv)
        let kek = try deriveKey(secret: secret, salt: salt, params: payload.kdfParams)
        let data = base64Decode(payload.wrappedKey)
        guard data.count > 16 else {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid wrapped key data."])
        }
        let cipher = data.prefix(data.count - 16)
        let tag = data.suffix(16)
        let sealed = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: iv), ciphertext: cipher, tag: tag)
        let rawKey = try AES.GCM.open(sealed, using: kek)
        return SymmetricKey(data: rawKey)
    }

    static func encryptDoc(_ dek: SymmetricKey, data: Data, aad: String?) throws -> (iv: String, ciphertext: String, aad: String?) {
        let iv = randomBytes(count: keyDerivationIvBytes)
        let aadData = aad?.data(using: .utf8)
        let sealed = try AES.GCM.seal(data, using: dek, nonce: AES.GCM.Nonce(data: iv), authenticating: aadData ?? Data())
        let ciphertext = sealed.ciphertext + sealed.tag
        return (iv: base64Encode(iv), ciphertext: base64Encode(ciphertext), aad: aad)
    }

    static func decryptDoc(_ dek: SymmetricKey, payload: VaultDocDetail) throws -> Data {
        let iv = base64Decode(payload.iv)
        let data = base64Decode(payload.ciphertext)
        guard data.count > 16 else {
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid encrypted payload."])
        }
        let cipher = data.prefix(data.count - 16)
        let tag = data.suffix(16)
        let aadData = payload.aad?.data(using: .utf8) ?? Data()
        let sealed = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: iv), ciphertext: cipher, tag: tag)
        return try AES.GCM.open(sealed, using: dek, authenticating: aadData)
    }

    private static func deriveKey(secret: String, salt: Data, params: VaultKdfParams) throws -> SymmetricKey {
        let password = Array(secret.utf8)
        let saltBytes = Array(salt)

        switch params.algo {
        case "scrypt":
            guard let N = params.N, let r = params.r, let p = params.p, let keyLen = params.keyLen else {
                throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid scrypt parameters."])
            }
            let keyBytes = try Scrypt(password: password, salt: saltBytes, dkLen: keyLen, N: N, r: r, p: p).calculate()
            return SymmetricKey(data: Data(keyBytes))
        case "pbkdf2":
            guard let iterations = params.iterations, let keyLen = params.keyLen else {
                throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid PBKDF2 parameters."])
            }
            let keyBytes = try PKCS5.PBKDF2(
                password: password,
                salt: saltBytes,
                iterations: iterations,
                keyLength: keyLen,
                variant: .sha2(.sha256)
            ).calculate()
            return SymmetricKey(data: Data(keyBytes))
        default:
            throw NSError(domain: "DocNearMe", code: 0, userInfo: [NSLocalizedDescriptionKey: "Unsupported KDF on iOS."])
        }
    }

    private static func randomBytes(count: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes)
    }

    private static func base64Encode(_ data: Data) -> String {
        data.base64EncodedString()
    }

    private static func base64Decode(_ value: String) -> Data {
        Data(base64Encoded: value) ?? Data()
    }

    private static func base64UrlEncode(_ data: Data) -> String {
        let base64 = data.base64EncodedString()
        return base64
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
