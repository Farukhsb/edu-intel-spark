import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildLtiLaunchTargetPath,
  clearLtiLaunchState,
  decodeLtiLaunchState,
  readLtiLaunchState,
  storeLtiLaunchState,
} from "@/lib/ltiLaunch";

const LtiLaunch = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const encodedState = params.get("state");
    if (!encodedState) return;

    const decodedState = decodeLtiLaunchState(encodedState);
    if (decodedState) {
      storeLtiLaunchState(decodedState);
    }
  }, [location.search]);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(location.search);
    const encodedState = params.get("state");
    const decodedState = encodedState ? decodeLtiLaunchState(encodedState) : readLtiLaunchState();
    const targetPath = decodedState ? buildLtiLaunchTargetPath(decodedState) : "/dashboard";

    if (user) {
      clearLtiLaunchState();
      navigate(targetPath, { replace: true });
      return;
    }

    navigate("/auth", { replace: true });
  }, [loading, location.search, navigate, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
};

export default LtiLaunch;
