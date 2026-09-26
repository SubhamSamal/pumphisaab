import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable } from "react-native";
import { z } from "zod";
import { Banner, Button, ScreenBody, ScreenHeader, StickyActionBar, Text, TextField, useIsWide } from "@/components/ui";
import { useMembership } from "@/features/session/SessionProvider";
import { useCreateManager } from "@/features/setup/queries";
import { MIN_PASSWORD_LENGTH, normaliseUsername, usernameProblem } from "@/lib/username";

const schema = z.object({
  fullName: z.string().trim().min(1, "Type the manager's full name."),
  username: z.string().superRefine((value, ctx) => {
    const problem = usernameProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
});
type Form = z.infer<typeof schema>;

/** Canvas Flow 13 · Add manager. Username and password only. */
export default function AddManager() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const create = useCreateManager(me.pump.id);
  const [show, setShow] = useState(false);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", username: "", password: "" },
  });

  if (me.role !== "owner") return <Redirect href="/" />;

  const onSubmit = handleSubmit((v) =>
    create.mutate(
      { fullName: v.fullName.trim(), username: normaliseUsername(v.username), password: v.password },
      { onSuccess: () => router.back() },
    ),
  );

  return (
    <>
      <ScreenHeader title="Add manager login" wide={wide} onBack={() => router.back()} />
      <ScreenBody
        sticky={
          <StickyActionBar>
            <Button label="Create login" loading={create.isPending} onPress={onSubmit} />
          </StickyActionBar>
        }
      >
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <TextField label="Full name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} capitalize="words" error={formState.errors.fullName?.message} />
          )}
        />
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextField
              label="Username"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              helper="Used to sign in. No email needed."
              error={formState.errors.username?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              label="Password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secure={!show}
              helper={`At least ${MIN_PASSWORD_LENGTH} characters.`}
              error={formState.errors.password?.message}
              right={
                <Pressable onPress={() => setShow((s) => !s)} hitSlop={12} accessibilityRole="button">
                  <Text variant="body" weight="600" tone="accent">
                    {show ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              }
            />
          )}
        />
        <Text variant="body" tone="secondary">
          A manager can fill and fix days until you lock them. They can&apos;t change prices or settings.
        </Text>
        {create.error ? <Banner tone="danger" title={create.error.message} /> : null}
      </ScreenBody>
    </>
  );
}
