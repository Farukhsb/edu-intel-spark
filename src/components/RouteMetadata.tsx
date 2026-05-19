import { useLocation } from "react-router-dom";

import { usePageMetadata } from "@/lib/seo";

const defaultMetadataByRoute = (pathname: string) => {
  if (pathname === "/" || pathname === "/privacy") {
    return null;
  }

  return {
    title: "GradeAI",
    description: "Secure academic assessment and analytics platform.",
    path: pathname,
    robots: "noindex,nofollow",
  } as const;
};

export const RouteMetadata = () => {
  const location = useLocation();
  const metadata = defaultMetadataByRoute(location.pathname);

  usePageMetadata(metadata);

  return null;
};
