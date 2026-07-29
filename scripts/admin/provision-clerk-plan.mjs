#!/usr/bin/env node

const secretKey = process.env.CLERK_SECRET_KEY?.trim() ?? '';
const userId = process.env.CLERK_USER_ID?.trim() ?? '';
const plan = process.env.CLERK_PLAN?.trim() || 'pro';

if (!/^sk_(?:live|test)_/.test(secretKey)) {
  throw new Error(
    'CLERK_SECRET_KEY must be a Clerk backend sk_live_ or sk_test_ key',
  );
}

if (!/^user_[A-Za-z0-9]+$/.test(userId)) {
  throw new Error('CLERK_USER_ID must be a Clerk user_ identifier');
}

if (plan !== 'pro') {
  throw new Error('The controlled provisioner only permits plan=pro');
}

const response = await fetch(
  `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/metadata`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vista-entitlement-provisioner/1.0',
    },
    body: JSON.stringify({
      public_metadata: {
        plan,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  },
);

if (!response.ok) {
  throw new Error(
    `Clerk metadata update failed with HTTP ${response.status}`,
  );
}

const result = await response.json();

if (result?.public_metadata?.plan !== 'pro') {
  throw new Error('Clerk did not confirm public_metadata.plan=pro');
}

console.log('PASS: Clerk public_metadata.plan=pro confirmed');
