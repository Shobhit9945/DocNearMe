import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getClinicReviewsCollection } from "../db";
import { ClinicReview } from "../types";

const parseRequestBody = (body: unknown): Record<string, unknown> => {
  if (body instanceof Buffer) {
    return parseRequestBody(body.toString("utf8"));
  }
  if (body instanceof Uint8Array) {
    return parseRequestBody(Buffer.from(body).toString("utf8"));
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  if (typeof body !== "string") return {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(trimmed);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return payload;
  }
};

const defaultRatings = (overall: number) => ({
  englishCommunication: overall,
  explainedTreatmentClearly: overall,
  foreignPatientFriendlyStaff: overall,
  cashlessPaymentAvailable: overall,
  waitTimeReasonable: overall,
});

const serializeReview = (review: ClinicReview) => {
  const legacyRating = (review as any).rating;
  const overallRating = review.overallRating ?? (typeof legacyRating === "number" ? legacyRating : 0);
  const ratings = review.ratings ?? defaultRatings(overallRating);
  return {
  id:
    review._id instanceof ObjectId
      ? review._id.toString()
      : review._id
        ? String(review._id)
        : "",
  clinicId: review.clinicId,
    appointmentId: review.appointmentId,
    patientId: review.patientId,
  author: review.author,
    overallRating,
    ratings,
    comment: review.comment ?? "",
    isPublic: review.isPublic ?? true,
  createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : review.createdAt,
  updatedAt: review.updatedAt instanceof Date ? review.updatedAt.toISOString() : review.updatedAt,
  };
};

const resolveReviewId = (reviewId: string) => (ObjectId.isValid(reviewId) ? new ObjectId(reviewId) : reviewId);

const isValidRating = (rating: number) => rating >= 1 && rating <= 5;

const normalizeRatings = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const fields = {
    englishCommunication: Number(payload.englishCommunication),
    explainedTreatmentClearly: Number(payload.explainedTreatmentClearly),
    foreignPatientFriendlyStaff: Number(payload.foreignPatientFriendlyStaff),
    cashlessPaymentAvailable: Number(payload.cashlessPaymentAvailable),
    waitTimeReasonable: Number(payload.waitTimeReasonable),
  };
  const ratings = Object.values(fields);
  if (ratings.some((rating) => !Number.isFinite(rating) || !isValidRating(rating))) return null;
  return fields;
};

export const handleListClinicReviews = async (req: Request, res: Response) => {
  const { clinicId } = req.params;
  if (!clinicId) {
    return res.status(400).json({ error: "Clinic ID is required." });
  }

  try {
    const reviewsCollection = await getClinicReviewsCollection();
    const reviews = await reviewsCollection
      .find({
        clinicId,
        $or: [{ isPublic: { $ne: false } }, { isPublic: { $exists: false } }],
      })
      .sort({ createdAt: -1 })
      .toArray();

    const serialized = reviews.map((review) => serializeReview(review as ClinicReview));
    const averageRating =
      serialized.length > 0
        ? Number(
            (
              serialized.reduce((sum, review) => sum + (review.overallRating ?? 0), 0) /
              serialized.length
            ).toFixed(1),
          )
        : 0;

    return res.json({ reviews: serialized, averageRating });
  } catch (error) {
    console.error("Failed to list clinic reviews", error);
    return res.status(500).json({ error: "Unable to load reviews." });
  }
};

export const handleCreateClinicReview = async (req: Request, res: Response) => {
  const { clinicId } = req.params;
  const payload = parseRequestBody(req.body);
  const { author, overallRating, ratings, comment, isPublic, appointmentId, patientId } = payload ?? {};

  if (!clinicId) {
    return res.status(400).json({ error: "Clinic ID is required." });
  }

  if (!author || overallRating === undefined || !ratings) {
    return res.status(400).json({ error: "Author, ratings, and overall rating are required." });
  }

  const numericRating = Number(overallRating);
  const normalizedRatings = normalizeRatings(ratings);
  if (!Number.isFinite(numericRating) || !isValidRating(numericRating)) {
    return res.status(400).json({ error: "Overall rating must be between 1 and 5." });
  }
  if (!normalizedRatings) {
    return res.status(400).json({ error: "Invalid category ratings." });
  }

  try {
    const reviewsCollection = await getClinicReviewsCollection();
    const review: ClinicReview = {
      clinicId,
      appointmentId: typeof appointmentId === "string" ? appointmentId : undefined,
      patientId: typeof patientId === "string" ? patientId : undefined,
      author: String(author).trim(),
      overallRating: numericRating,
      ratings: normalizedRatings,
      comment: typeof comment === "string" ? comment.trim() : undefined,
      isPublic: typeof isPublic === "boolean" ? isPublic : undefined,
      createdAt: new Date(),
    };

    const result = await reviewsCollection.insertOne(review);
    const inserted = {
      ...review,
      _id: review._id ?? result.insertedId,
    };

    return res.status(201).json({ success: true, review: serializeReview(inserted) });
  } catch (error) {
    console.error("Failed to create clinic review", error);
    return res.status(500).json({ error: "Unable to save review." });
  }
};

export const handleUpdateClinicReview = async (req: Request, res: Response) => {
  const { clinicId, reviewId } = req.params;
  const payload = parseRequestBody(req.body);
  const { author, overallRating, ratings, comment, isPublic } = payload ?? {};

  if (!clinicId || !reviewId) {
    return res.status(400).json({ error: "Clinic ID and review ID are required." });
  }

  if (!author || overallRating === undefined || !ratings) {
    return res.status(400).json({ error: "Author, ratings, and overall rating are required." });
  }

  const numericRating = Number(overallRating);
  const normalizedRatings = normalizeRatings(ratings);
  if (!Number.isFinite(numericRating) || !isValidRating(numericRating)) {
    return res.status(400).json({ error: "Overall rating must be between 1 and 5." });
  }
  if (!normalizedRatings) {
    return res.status(400).json({ error: "Invalid category ratings." });
  }

  try {
    const reviewsCollection = await getClinicReviewsCollection();
    const resolvedId = resolveReviewId(reviewId);

    const result = await reviewsCollection.updateOne(
      { _id: resolvedId, clinicId },
      {
        $set: {
          author: String(author).trim(),
          overallRating: numericRating,
          ratings: normalizedRatings,
          comment: typeof comment === "string" ? comment.trim() : undefined,
          isPublic: typeof isPublic === "boolean" ? isPublic : undefined,
          updatedAt: new Date(),
        },
      },
    );

    if (!result.matchedCount) {
      return res.status(404).json({ error: "Review not found." });
    }

    const updated = await reviewsCollection.findOne({ _id: resolvedId, clinicId });
    if (!updated) {
      return res.status(404).json({ error: "Review not found." });
    }

    return res.json({ success: true, review: serializeReview(updated as ClinicReview) });
  } catch (error) {
    console.error("Failed to update clinic review", error);
    return res.status(500).json({ error: "Unable to update review." });
  }
};

export const handleDeleteClinicReview = async (req: Request, res: Response) => {
  const { clinicId, reviewId } = req.params;

  if (!clinicId || !reviewId) {
    return res.status(400).json({ error: "Clinic ID and review ID are required." });
  }

  try {
    const reviewsCollection = await getClinicReviewsCollection();
    const resolvedId = resolveReviewId(reviewId);
    const result = await reviewsCollection.deleteOne({ _id: resolvedId, clinicId });

    if (!result.deletedCount) {
      return res.status(404).json({ error: "Review not found." });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete clinic review", error);
    return res.status(500).json({ error: "Unable to delete review." });
  }
};
