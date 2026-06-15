import type { NextConfig } from "next";

// 배포마다 달라지는 빌드 식별자 (새 버전 감지용).
// Vercel 배포 ID/커밋 SHA가 있으면 사용하고, 없으면 빌드 시각.
const BUILD_ID =
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  String(Date.now());

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
