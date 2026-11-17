import { Suspense } from "react";
import { App } from "@/components/App";
import { AppLoading } from "@/components/AppLoading";
import { StoreProvider } from "@/lib/store";

export default function Home() {
  return (
    <StoreProvider>
      {/* App reads the URL (useSearchParams), so it needs a Suspense boundary to keep `/` prerendered. */}
      <Suspense fallback={<AppLoading />}>
        <App />
      </Suspense>
    </StoreProvider>
  );
}
