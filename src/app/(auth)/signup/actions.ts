'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getResponseError } from '@/lib/fetch-response';

const signupSchema = z
  .object({
    email: z.email('Enter a valid email'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please Enter Password'),
    username: z.string().min(1, 'Username is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupResponse =
  | { ok: true }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    };
type SignupRequest = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  username: string;
};
export async function signup(
  _prevState: SignupResponse,
  formData: FormData
): Promise<SignupResponse> {
  const raw = Object.fromEntries(formData);
  const values = {
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    username: String(formData.get('username') ?? ''),
    email: String(formData.get('email') ?? ''),
  };
  const parsed = signupSchema.safeParse(<SignupRequest>raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }

    return { ok: false, fieldErrors, values };
  }

  try {
    const response = await fetch(
      `${process.env.SPRING_BASE_URL || 'http://localhost:8080'}/auth/signup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      }
    );

    if (!response.ok) {
      throw new Error(await getResponseError(response, `Sign up failed (HTTP ${response.status})`));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sign up failed';
    console.error('sign up error:', message);
    return {
      ok: false,
      error: message,
      values,
    };
  }
  redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}`);
}
