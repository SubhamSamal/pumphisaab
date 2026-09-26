import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Banner,
  BottomSheet,
  Button,
  ErrorState,
  ListItem,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  StatusPill,
  Text,
  TextField,
  Toast,
  useIsWide,
} from "@/components/ui";
import { useMembership } from "@/features/session/SessionProvider";
import { useMembers, useResetPassword, useSetLoginActive, type Member } from "@/features/setup/queries";
import { MIN_PASSWORD_LENGTH } from "@/lib/username";

/** Canvas Flow 13 · Logins (owner only). */
export default function LoginsScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const members = useMembers(me.pump.id);
  const [selected, setSelected] = useState<Member | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (me.role !== "owner") return <Redirect href="/" />;

  return (
    <>
      <ScreenHeader title="Logins" wide={wide} onBack={() => router.back()} />
      <ScreenBody
        sticky={
          <StickyActionBar>
            <Button label="Add manager" icon="plus" onPress={() => router.push("/profile/add-manager")} />
          </StickyActionBar>
        }
      >
        <Text variant="body" tone="secondary">
          A manager can fill and fix days until you lock them. They can&apos;t change prices or settings.
        </Text>
        {members.isPending ? (
          <View className="gap-8">
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : members.isError ? (
          <ErrorState title="Couldn't load logins" body="Check the internet and try again." onRetry={() => members.refetch()} />
        ) : (
          <View>
            {members.data.map((m) => (
              <ListItem
                key={m.id}
                title={m.fullName}
                detail={`${m.role === "OWNER" ? "Owner" : "Manager"} · username ${m.username}`}
                icon="user"
                right={m.isActive ? undefined : <StatusPill status="draft" label="Switched off" />}
                onPress={m.role === "MANAGER" ? () => setSelected(m) : undefined}
              />
            ))}
          </View>
        )}
        {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
      </ScreenBody>

      <ManagerSheet
        member={selected}
        pumpId={me.pump.id}
        onClose={() => setSelected(null)}
        onDone={(message) => {
          setSelected(null);
          setToast(message);
        }}
      />
    </>
  );
}

function ManagerSheet({
  member,
  pumpId,
  onClose,
  onDone,
}: {
  member: Member | null;
  pumpId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const reset = useResetPassword(pumpId);
  const setActive = useSetLoginActive(pumpId);
  const problem = (reset.error ?? setActive.error)?.message;

  const close = () => {
    setPassword("");
    reset.reset();
    setActive.reset();
    onClose();
  };

  return (
    <BottomSheet visible={member !== null} onClose={close}>
      {member ? (
        <>
          <View className="gap-4">
            <Text variant="heading">{member.fullName}</Text>
            <Text variant="label" weight="400" tone="secondary">
              username {member.username}
            </Text>
          </View>
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secure={!show}
            helper={`At least ${MIN_PASSWORD_LENGTH} characters. Tell the manager on the phone.`}
            right={
              <Pressable onPress={() => setShow((s) => !s)} hitSlop={12} accessibilityRole="button">
                <Text variant="body" weight="600" tone="accent">
                  {show ? "Hide" : "Show"}
                </Text>
              </Pressable>
            }
          />
          {problem ? <Banner tone="danger" title={problem} /> : null}
          <Button
            label="Save new password"
            loading={reset.isPending}
            disabled={password.length < MIN_PASSWORD_LENGTH}
            onPress={() =>
              reset.mutate({ memberId: member.id, password }, { onSuccess: () => { setPassword(""); onDone(`New password saved for ${member.fullName}`); } })
            }
          />
          <Button
            label={member.isActive ? "Switch this login off" : "Switch this login back on"}
            variant={member.isActive ? "destructive" : "secondary"}
            loading={setActive.isPending}
            onPress={() =>
              setActive.mutate(
                { memberId: member.id, active: !member.isActive },
                { onSuccess: () => onDone(member.isActive ? `${member.fullName} can't sign in now` : `${member.fullName} can sign in again`) },
              )
            }
          />
        </>
      ) : null}
    </BottomSheet>
  );
}
