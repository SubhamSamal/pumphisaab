import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, TextInput, View } from "react-native";
import { z } from "zod";
import { Banner, Button, KeyboardSafeScroll, LogoMark, Text, TextField, ToggleRow, Wordmark } from "@/components/ui";
import { useSession } from "@/features/session/SessionProvider";

const schema = z.object({
  username: z.string().trim().min(1, "Type your username."),
  password: z.string().min(1, "Type your password."),
  keepSignedIn: z.boolean(),
});
type Form = z.infer<typeof schema>;

/** Canvas Flow 1 · Sign in. Username and password only. */
export default function SignIn() {
  const { signIn } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", keepSignedIn: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setProblem(null);
    const { error } = await signIn(values.username, values.password, values.keepSignedIn);
    if (error) setProblem(error);
    // On success the session changes and the app opens by itself.
  });

  return (
    // revealToEnd: with the keyboard open, the Sign in button stays visible under the password box.
    <KeyboardSafeScroll contentContainerClassName="px-24 pb-24 pt-[96px]" revealToEnd>
        <View className="w-full max-w-content gap-40 self-center">
          {/* Logo beside the name (owner, 27 Sep): a shorter top, so the form fits above the keyboard. */}
          <View className="flex-row items-center gap-12">
            <LogoMark />
            <Wordmark />
          </View>

          <View className="gap-16">
            <Controller
              control={control}
              name="username"
              render={({ field }) => (
                <TextField
                  label="Username"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoComplete="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
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
                  secure={!showPassword}
                  autoComplete="current-password"
                  inputRef={passwordRef}
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  error={formState.errors.password?.message}
                  right={
                    <Pressable
                      onPress={() => setShowPassword((s) => !s)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    >
                      <Text variant="body" weight="600" tone="accent">
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  }
                />
              )}
            />
            <Controller
              control={control}
              name="keepSignedIn"
              render={({ field }) => <ToggleRow label="Keep me signed in" value={field.value} onChange={field.onChange} />}
            />

            {problem ? <Banner tone="danger" title={problem} /> : null}

            <Button label={formState.isSubmitting ? "Signing in…" : "Sign in"} loading={formState.isSubmitting} onPress={onSubmit} />
            <Text variant="label" weight="400" tone="secondary" className="text-center">
              Forgot password? Ask the owner to reset it.
            </Text>
          </View>
        </View>
    </KeyboardSafeScroll>
  );
}
