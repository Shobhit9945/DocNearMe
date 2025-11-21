import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import prisma from '../../../../../lib/prisma'

export async function POST(request) {
  try {
    const { name, email, password } = await request.json()

    const trimmedName = name?.trim()
    const trimmedEmail = email?.trim()

    if (!trimmedName || !trimmedEmail || !password) {
      return NextResponse.json(
        { success: false, message: 'Name, email, and password are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = trimmedEmail.toLowerCase()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const passwordValidation = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password)
    ]

    if (passwordValidation.includes(false)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Password must be at least 8 characters and include upper and lower case letters, a number, and a special character.'
        },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      const message = existingUser.password
        ? 'An account already exists with this email. Please sign in instead.'
        : 'This email is registered through Google sign-in. Please continue with Google.'

      return NextResponse.json(
        { success: false, message },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully. You can now sign in.'
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[auth/register] error', error)

    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          message: 'An account already exists with this email. Please sign in.'
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
