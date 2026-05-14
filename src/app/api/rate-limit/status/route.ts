import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function GET() {
    return NextResponse.json(rateLimit.getStatus());
}
