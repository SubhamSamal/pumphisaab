import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Banner, ErrorState, ProductTag, ScreenBody, ScreenHeader, Skeleton, Text, ToggleRow, useIsWide } from "@/components/ui";
import { useDaySetup, useSetNozzleInUse } from "@/features/day/queries";
import { useMembership } from "@/features/session/SessionProvider";

/**
 * Profile › Nozzles (owner, D100): switch a nozzle on when it starts being used (it then shows on
 * every shift; its first opening is typed) or off when it stops. Past readings stay as they were.
 */
export default function NozzlesScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const setup = useDaySetup(me.pump.id);
  const save = useSetNozzleInUse(me.pump.id);
  // The switch moves at once; the save runs behind it.
  const [shown, setShown] = useState<Record<string, boolean>>({});

  return (
    <>
      <ScreenHeader title="Nozzles" wide={wide} onBack={() => router.back()} />
      <ScreenBody>
        <Text variant="body" tone="secondary">
          Switch a nozzle on when it starts being used: it shows on every shift from then, and its first opening is typed from the meter. Switch it off when it stops.
        </Text>
        {save.error ? <Banner tone="danger" title={save.error.message} /> : null}
        {setup.isPending ? (
          <Skeleton height={240} />
        ) : setup.isError ? (
          <ErrorState title="Couldn't load the nozzles" body="Check the internet and try again." onRetry={() => setup.refetch()} />
        ) : (
          <View>
            {setup.data.nozzles.map((n) => {
              const on = n.id in shown ? shown[n.id] : n.inUse;
              return (
                <View key={n.id} className="flex-row items-center gap-12 border-b border-border">
                  <ProductTag product={n.product} />
                  <View className="min-w-0 flex-1">
                    <ToggleRow
                      label={n.label}
                      helper={on ? "In use: shows on every shift" : "Not in use: hidden"}
                      value={on}
                      onChange={(v) => {
                        setShown((s) => ({ ...s, [n.id]: v }));
                        save.mutate({ nozzleId: n.id, inUse: v }, { onError: () => setShown((s) => ({ ...s, [n.id]: !v })) });
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScreenBody>
    </>
  );
}
