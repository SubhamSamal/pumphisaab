import { Redirect } from "expo-router";
import { View } from "react-native";
import { Button, EmptyState, ErrorState, ScreenBody, Skeleton, Text } from "@/components/ui";
import { useSession } from "@/features/session/SessionProvider";

/** Shown while signing in is being worked out, and when a login has no pump yet. */
export default function Starting() {
  const { status, errorMessage, retry, signOut } = useSession();

  if (status === "ready") return <Redirect href="/" />;
  if (status === "signedOut") return <Redirect href="/sign-in" />;

  if (status === "noPump") {
    return (
      <ScreenBody>
        <EmptyState
          icon="sliders"
          title="The pump isn't set up yet"
          body="This login isn't linked to a pump, or it was switched off. Ask the owner, then tap Check again."
          action={{ label: "Check again", onPress: retry }}
          secondary={{ label: "Sign out", onPress: signOut }}
        />
      </ScreenBody>
    );
  }

  if (status === "error") {
    return (
      <ScreenBody>
        <ErrorState title="Couldn't load your pump" body={errorMessage ?? "Check the internet and try again."} onRetry={retry} />
      </ScreenBody>
    );
  }

  if (status === "notConfigured") {
    return (
      <ScreenBody>
        <View className="gap-12 py-40">
          <Text variant="title">Almost ready</Text>
          <Text variant="body" tone="secondary">
            The app isn&apos;t connected to the database yet. Copy .env.example to .env and paste the Supabase URL and anon
            key, then restart the app.
          </Text>
          <Button label="Try again" variant="secondary" size="M" onPress={retry} />
        </View>
      </ScreenBody>
    );
  }

  // starting / loading: grey blocks in the shape of the Today list, so nothing jumps.
  return (
    <ScreenBody>
      <View className="gap-12 pt-40" accessibilityLabel="Loading">
        <Skeleton height={28} width="60%" />
        <Skeleton height={8} />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={64} />
        ))}
      </View>
    </ScreenBody>
  );
}
