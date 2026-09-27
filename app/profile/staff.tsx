import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Banner,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  Switch,
  Text,
  TextField,
  useIsWide,
} from "@/components/ui";
import { useMembership } from "@/features/session/SessionProvider";
import { useAddStaff, useStaff, useUpdateStaff, type StaffMember } from "@/features/setup/queries";

/** Profile › Staff (decision D38): add, rename, switch off. Owner and managers. */
export default function StaffScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const staff = useStaff(me.pump.id);
  const update = useUpdateStaff(me.pump.id);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);

  return (
    <>
      <ScreenHeader title="Staff" wide={wide} onBack={() => router.back()} />
      <ScreenBody
        sticky={
          <StickyActionBar>
            <Button label="Add staff" icon="plus" onPress={() => setEditing("new")} />
          </StickyActionBar>
        }
      >
        <Text variant="body" tone="secondary">
          These names show as chips on each shift. Switch someone off when they leave; their past shifts stay as they were.
        </Text>
        {update.error ? <Banner tone="danger" title={update.error.message} /> : null}
        {staff.isPending ? (
          <View className="gap-8">
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : staff.isError ? (
          <ErrorState title="Couldn't load staff" body="Check the internet and try again." onRetry={() => staff.refetch()} />
        ) : staff.data.length === 0 ? (
          <EmptyState icon="user" title="No staff yet" body="Add the attendants who work the shifts." action={{ label: "Add staff", onPress: () => setEditing("new") }} />
        ) : (
          <View>
            {staff.data.map((s) => (
              <View key={s.id} className="min-h-[64px] flex-row items-center gap-12 border-b border-border py-[10px]">
                <Pressable className="min-w-0 flex-1" onPress={() => setEditing(s)} accessibilityRole="button" accessibilityLabel={`Rename ${s.name}`}>
                  <Text variant="body" weight="600" tone={s.isActive ? "primary" : "muted"}>
                    {s.name}
                  </Text>
                  <Text variant="label" weight="400" tone="secondary">
                    {s.isActive ? "Working · tap to rename" : "Switched off"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => update.mutate({ member: s, changes: { is_active: !s.isActive } })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: s.isActive }}
                  accessibilityLabel={`${s.name} working`}
                  hitSlop={8}
                >
                  <Switch value={s.isActive} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScreenBody>
      <StaffSheet pumpId={me.pump.id} editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function StaffSheet({ pumpId, editing, onClose }: { pumpId: string; editing: StaffMember | "new" | null; onClose: () => void }) {
  const add = useAddStaff(pumpId);
  const update = useUpdateStaff(pumpId);
  const [name, setName] = useState("");
  const [lastEditing, setLastEditing] = useState(editing);
  const isNew = editing === "new";

  // Fill the box when the sheet opens for someone.
  if (editing !== lastEditing) {
    setLastEditing(editing);
    setName(editing && editing !== "new" ? editing.name : "");
  }

  const close = () => {
    add.reset();
    update.reset();
    onClose();
  };
  const problem = (add.error ?? update.error)?.message;
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isNew) add.mutate(trimmed, { onSuccess: close });
    else if (editing) update.mutate({ member: editing, changes: { name: trimmed } }, { onSuccess: close });
  };

  return (
    <BottomSheet visible={editing !== null} onClose={close}>
      <Text variant="heading">{isNew ? "Add staff" : "Rename"}</Text>
      <TextField label="Name" value={name} onChangeText={setName} capitalize="words" returnKeyType="done" onSubmitEditing={save} autoFocus />
      {problem ? <Banner tone="danger" title={problem} /> : null}
      <Button label={isNew ? "Add" : "Save"} loading={add.isPending || update.isPending} disabled={!name.trim()} onPress={save} />
    </BottomSheet>
  );
}
