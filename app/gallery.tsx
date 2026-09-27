import { Redirect, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import {
  AutoTag,
  AutoValueRow,
  Banner,
  BellButton,
  BottomNav,
  BottomSheet,
  Button,
  CalendarCell,
  CalendarLegend,
  ChamberHeader,
  ChamberRow,
  Card,
  Chip,
  ChipGroup,
  DateStepper,
  DifferenceValue,
  DipInput,
  Divider,
  EmptyState,
  ErrorState,
  FlagNote,
  Icon,
  InfoChip,
  KeyValueRow,
  ListItem,
  LogoMark,
  NoteCountRow,
  NozzleColumnHeader,
  NozzleGroupHeader,
  NozzleRow,
  NumericInput,
  PriceChip,
  PriceStrip,
  ProductTag,
  ProgressBar,
  SaveIndicator,
  ScreenBody,
  ScreenHeader,
  SectionCard,
  SegmentedControl,
  SideRail,
  Skeleton,
  StatusPill,
  StickyActionBar,
  SuggestList,
  Text,
  TextField,
  Toast,
  ToggleRow,
  Wordmark,
  useIsWide,
  type DayResult,
  type IconName,
  type NavItem,
} from "@/components/ui";
import { fmtRupees } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Developer-only component gallery (decision D8). Every design-system component in its states,
 * using the canvas sample data (Shree Lokanath, 01 Oct 2026). Compare against docs/design/.
 */
export default function Gallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <GalleryContent />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-12 border-t border-border pt-16">
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted">
      {children}
    </Text>
  );
}

const ICONS: IconName[] = [
  "today", "rupee", "truck", "dashboard", "user", "bell", "lock", "unlock", "check", "chevronRight",
  "chevronLeft", "chevronDown", "warning", "error", "close", "plus", "minus", "clock", "history", "edit",
  "upload", "message", "offline", "signOut", "calendar", "search", "info", "arrowRight", "retry", "drop",
  "sliders", "send", "wallet", "flag", "gauge", "phone",
];

const CAL: { d: number; r: DayResult; today?: boolean }[] = [
  { d: 0, r: "blank" }, { d: 0, r: "blank" }, { d: 1, r: "matched" }, { d: 2, r: "matched" },
  { d: 3, r: "late" }, { d: 4, r: "notMatched" }, { d: 5, r: "notSent" },
  { d: 6, r: "matched" }, { d: 7, r: "matched", today: true },
];

function GalleryContent() {
  const router = useRouter();
  const wide = useIsWide();
  const { preference, setPreference } = useTheme();
  const [closing, setClosing] = useState("48890");
  const [amount, setAmount] = useState("121600");
  const [vehicle, setVehicle] = useState("OD05AB1234");
  const [attendants, setAttendants] = useState(["Ramesh", "Suresh"]);
  const [shift, setShift] = useState<"A" | "B" | "C">("B");
  const [testing, setTesting] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [navActive, setNavActive] = useState("index");

  const nav = (keys: [string, string, IconName][]): NavItem[] =>
    keys.map(([key, label, icon]) => ({ key, label, icon, active: navActive === key, onPress: () => setNavActive(key) }));
  const managerNav = nav([["index", "Today", "today"], ["sales", "Sales", "rupee"], ["tanker", "Tanker", "truck"], ["profile", "Profile", "user"]]);
  const ownerNav = nav([["index", "Today", "today"], ["sales", "Sales", "rupee"], ["tanker", "Tanker", "truck"], ["dashboard", "Dashboard", "dashboard"], ["profile", "Profile", "user"]]);

  return (
    <>
      <ScreenHeader title="Component gallery" wide={wide} onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <ScreenBody>
        <Banner tone="info" title="Developer only">
          Not in the real app. Switch theme here to check every component in light and dark.
        </Banner>
        <SegmentedControl
          options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "auto", label: "Auto" }] as const}
          value={preference}
          onChange={setPreference}
        />

        <Section title="Logo">
          <View className="flex-row items-center gap-16">
            <LogoMark />
            <LogoMark size={48} />
          </View>
          <Wordmark />
        </Section>

        <Section title="Type scale">
          <Text variant="display">₹10,17,142</Text>
          <Text variant="title">Shift B readings</Text>
          <Text variant="heading">Opening dip</Text>
          <Text variant="body">Type 8 closing readings, one after another.</Text>
          <Text variant="label" tone="secondary">IOCL report stock</Text>
          <Text variant="caption" tone="muted">Open 48,210.00</Text>
          <Text variant="number-input">14,820 L</Text>
          <Text variant="number-inline">3,180 L × ₹90.00</Text>
          <Text variant="body" slashedZero>OD05AB1234 · OD02CD9087</Text>
        </Section>

        <Section title="Icons">
          <View className="flex-row flex-wrap gap-12">
            {ICONS.map((n) => (
              <Icon key={n} name={n} />
            ))}
          </View>
        </Section>

        <Section title="Buttons">
          <Button label="Review and submit" />
          <Button label="Save tanker" variant="secondary" />
          <Button label="Saving…" loading />
          <Button label="Finish 4 more sections to submit" disabled />
          <Button label="Unlock day" variant="destructive" icon="unlock" />
          <View className="flex-row flex-wrap gap-8">
            <Button label="Confirm" size="M" />
            <Button label="Add note" size="M" variant="secondary" icon="message" />
            <Button label="Change" size="M" variant="ghost" />
          </View>
        </Section>

        <Section title="Pills, tags, chips">
          <View className="flex-row flex-wrap gap-8">
            <StatusPill status="draft" />
            <StatusPill status="submitted" />
            <StatusPill status="locked" />
            <StatusPill status="matched" />
            <StatusPill status="notMatched" />
            <StatusPill status="flag" label="1 flag" />
          </View>
          <View className="flex-row flex-wrap items-center gap-8">
            <ProductTag product="HSD" />
            <ProductTag product="MS" />
            <ProductTag product="HSD" suffix="A" />
            <AutoTag />
            <PriceChip product="HSD" price="₹90.00" />
            <PriceChip product="MS" price="₹101.00" />
          </View>
        </Section>

        <Section title="Difference (sign rule)">
          <Label>Loss is negative, red, true minus. Excess amber. Zero green.</Label>
          <DifferenceValue value="-1250" unit="rupees" />
          <DifferenceValue value="300" unit="rupees" />
          <DifferenceValue value="0" unit="rupees" />
          <DifferenceValue value="-42" unit="litres" percentOf="8000" />
          <DifferenceValue value="-30" unit="litres" withinLimit />
          <DifferenceValue value="-42" unit="litres" hideWord />
          <DifferenceValue value="-1250" unit="rupees" look="inline" />
        </Section>

        <Section title="Number inputs">
          <NumericInput
            label="Shift A · 6 AM to 2 PM"
            value={amount}
            onChangeText={setAmount}
            unit="₹"
            formatted={/^\d+(\.\d+)?$/.test(amount) ? fmtRupees(amount, "input").replace("₹", "") : undefined}
          />
          <NumericInput label="Shift C · 10 PM to 6 AM" value="" unit="₹" placeholder="After the shift ends" />
          <NumericInput label="IOCL report stock" value="14900" unit="L" warning helper="Dip is 80 L less than the IOCL report." />
          <NumericInput label="Closing dip reading" value="1714" unit="cm" error="This tank only goes up to 210.0 cm. Did you mean 171.4?" />
          <NumericInput label="Disabled" value="" unit="₹" disabled helper="Opens after Shift A is done." />
          <NumericInput label="PhonePe today" value="254000" formatted="₹2,54,000" auto />
          <AutoValueRow label="Dip in litres" value="13,870.76 L" />
        </Section>

        <Section title="Text fields">
          <TextField label="Vehicle number" value={vehicle} onChangeText={setVehicle} vehicle />
          <TextField label="Slip number" value="4471" error="Slip 4471 is already saved for Mahanadi Coalfields. Check the slip number." />
        </Section>

        <Section title="Dip input">
          <DipInput cm="128.5" litres="13,870.76 L" reference="Last night's closing dip: 128.5 cm" />
          <DipInput label="Closing dip reading" cm="1714" error="This tank only goes up to 210.0 cm. Did you mean 171.4?" />
          <FlagNote emphasis="Check the dip once more.">Dip is 80 L less than the IOCL report.</FlagNote>
        </Section>

        <Section title="Nozzle rows">
          <NozzleGroupHeader product="HSD" detail="· ₹90.00/L" />
          <NozzleColumnHeader />
          <NozzleRow label="HSD-A" opening="48,210.00" closing={closing} onChangeClosing={setClosing} sale="680.00" />
          <NozzleRow label="HSD-B" opening="31,455.50" closing="31265.50" error="Less than the opening. Check the meter." />
          <NozzleRow label="HSD-C" opening="52,904.00" closing="" />
          <NozzleGroupHeader product="MS" detail="· ₹101.00/L" />
          <NozzleRow label="MS-A" opening="19,850.00" closing="20204" sale="354.00" openingState="pending" note="New opening waits for the owner." />
          <NozzleRow label="MS-D" opening="19,850.00" closing="20204" sale="354.00" openingState="approved" note="Meter change approved." noteTone="success" />
          <NozzleRow label="MS-B" opening="—" closing="" placeholder="After Shift A" />
          <NozzleRow label="MS-C" openingInput={{ value: "", onChange: () => {} }} closing="" />
        </Section>

        <Section title="Tanker chambers">
          <ChamberHeader />
          <ChamberRow no={1} litres="4000" dipBefore="59.8" dipAfter="91.7" rise="3,999.99 L" short="short 0.01 L" />
          <ChamberRow no={2} litres="4000" dipBefore="91.7" dipAfter="122.2" rise="3,985.55 L" short="short 14.46 L" shortWarn />
          <ChamberRow no={3} litres="" dipBefore="" dipAfter="" />
          <View className="flex-row flex-wrap gap-8">
            <InfoChip label="Selling" value="₹101.74" />
            <InfoChip label="Margin" value="₹2.60" onPress={() => {}} />
            <InfoChip label="Margin" value="not set" tone="warning" />
          </View>
        </Section>

        <Section title="Cash note count">
          <NoteCountRow note="₹500" count="150" amount="₹75,000" />
          <NoteCountRow note="₹200" count="" amount="₹0" />
        </Section>

        <Section title="Price confirm strip">
          <PriceStrip state="toConfirm" note="Same as yesterday" items={[{ product: "HSD", price: "₹90.00" }, { product: "MS", price: "₹101.00" }]} />
          <PriceStrip
            state="changed"
            note="Set by owner"
            items={[
              { product: "HSD", price: "₹90.50", was: "₹90.00" },
              { product: "MS", price: "₹101.00" },
            ]}
          />
          <PriceStrip state="confirmed" items={[{ product: "HSD", price: "₹90.00" }, { product: "MS", price: "₹101.00" }]} />
        </Section>

        <Section title="Date stepper">
          <DateStepper label="Thu, 01 Oct 2026" caption="Today" canNext={false} />
          <DateStepper label="Tue, 15 Sep 2026" caption="16 days ago" />
        </Section>

        <Section title="Today">
          <ProgressBar done={4} total={8} left={<StatusPill status="draft" />} save="saved" />
          <SectionCard title="Opening dip" subtitle="Done · 2 tanks" status="done" />
          <SectionCard title="Tanker" subtitle="Done · OD02CD9087" status="done" flags={1} />
          <SectionCard title="Shift B readings" subtitle="6 of 8 nozzles" status="inProgress" />
          <SectionCard title="Shift C readings" subtitle="To do · 10 PM to 6 AM" status="todo" />
          <SectionCard title="Closing dip" subtitle="1 reading outside the chart" status="inProgress" errors={1} />
          <SectionCard title="Sales" subtitle="View only" status="locked" />
          <View className="flex-row flex-wrap gap-16">
            <SaveIndicator state="saved" />
            <SaveIndicator state="saving" />
            <SaveIndicator state="offline" />
          </View>
        </Section>

        <Section title="Choices">
          <Label>Attendant chips</Label>
          <ChipGroup>
            {["Ramesh", "Suresh", "Bikash"].map((n) => (
              <Chip
                key={n}
                label={n}
                selected={attendants.includes(n)}
                onPress={() => setAttendants((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]))}
              />
            ))}
          </ChipGroup>
          <SegmentedControl options={[{ value: "A", label: "A" }, { value: "B", label: "B" }, { value: "C", label: "C" }] as const} value={shift} onChange={setShift} />
          <ToggleRow label="Testing done this shift?" helper="5 L measure check" value={testing} onChange={setTesting} />
        </Section>

        <Section title="Banners">
          <Banner tone="danger" title="Yesterday (01 Oct) isn't submitted" action={<Button label="Open 01 Oct" size="M" variant="secondary" />}>
            You can fill today, but you can submit it only after 01 Oct.
          </Banner>
          <Banner tone="warning" title="Offline" icon="offline">
            No internet. Keep typing. Your numbers are kept on this phone.
          </Banner>
          <Banner tone="success" title="01 Oct submitted">
            The owner has been told.
          </Banner>
          <Banner tone="info" title="Note from owner on Shift B sales" icon="message">
            Please check PhonePe for 2 PM to 10 PM.
          </Banner>
        </Section>

        <Section title="Cards and rows">
          <Card tone="summary">
            <View className="flex-row items-center justify-between">
              <Text variant="heading">Shift B</Text>
              <DifferenceValue value="-1250" unit="rupees" />
            </View>
            <KeyValueRow label="Should have" value="₹4,02,350" />
            <KeyValueRow label="Cash" value="₹1,48,600" indent />
            <KeyValueRow label="Cash paid out (expenses)" value="₹2,950" indent />
            <Divider />
            <KeyValueRow label="Received" value="₹4,01,100" big />
          </Card>
          <SuggestList
            items={[
              { id: "1", label: "ABC Traders", selected: true },
              { id: "2", label: "ABCD Logistics" },
            ]}
            onPick={() => {}}
            addLabel="Add “ABCDE” as a new company"
            onAdd={() => {}}
          />
          <View>
            <ListItem title="Mahanadi Coalfields" detail="OD05AB1234 · Slip 4471 · HSD 320 L" icon="wallet" right="₹28,800" slashedZeroDetail />
            <ListItem title="Bakshis" detail="From Shift B cash" warning="More than the ₹300 daily limit" right="₹500" onPress={() => {}} />
            <ListItem title="Diesel short 42 L" detail="01 Oct · Tank vs meters" icon="warning" iconTone="danger" onPress={() => {}} />
            <ListItem title="Shift C excess ₹300" detail="01 Oct · Sales" icon="flag" iconTone="warning" onPress={() => {}} />
          </View>
        </Section>

        <Section title="Calendar">
          <View className="flex-row gap-[6px]">
            {CAL.slice(0, 7).map((c, i) => (
              <CalendarCell key={i} day={c.d} result={c.r} today={c.today} />
            ))}
          </View>
          <View className="flex-row gap-[6px]">
            {[...CAL.slice(7), ...Array.from({ length: 5 }, () => ({ d: 0, r: "blank" as DayResult, today: false }))].map((c, i) => (
              <CalendarCell key={i} day={c.d} result={c.r} today={c.today} />
            ))}
          </View>
          <CalendarLegend />
        </Section>

        <Section title="States">
          <Skeleton height={64} />
          <Skeleton height={64} width="70%" />
          <EmptyState
            icon="wallet"
            title="No credit slips yet"
            body="When a company vehicle fills on credit, add its slip here."
            action={{ label: "Add credit slip", onPress: () => {} }}
            secondary={{ label: "No credit today", onPress: () => {} }}
          />
          <ErrorState title="Couldn't load sales" body="Check the internet. Nothing you typed is lost." onRetry={() => {}} />
          <Toast message="Opening dip done" />
          <Toast message="Couldn't save. Check the internet." tone="error" onDismiss={() => {}} />
        </Section>

        <Section title="Bottom sheet">
          <Button label="Open sheet" variant="secondary" size="M" onPress={() => setSheet(true)} />
        </Section>

        <Section title="Navigation">
          <View className="flex-row items-center gap-16">
            <BellButton />
            <BellButton count={2} />
            <BellButton count={12} />
          </View>
          <Label>Manager</Label>
          <BottomNav items={managerNav} />
          <Label>Owner</Label>
          <BottomNav items={ownerNav} />
          <Label>Web rail (1024 px and wider)</Label>
          <View className="h-[420px] flex-row">
            <SideRail items={ownerNav} />
          </View>
        </Section>

        <Section title="Sticky action bar">
          <StickyActionBar note={<SaveIndicator state="offline" waiting={3} />}>
            <Button label="Done · Next: Tanker" />
          </StickyActionBar>
        </Section>
      </ScreenBody>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)}>
        <Text variant="heading">Change MS-A opening?</Text>
        <KeyValueRow label="Shift A closed at" value="19,884.00" />
        <KeyValueRow label="You typed" value="19,850.00" />
        <Text variant="body" tone="secondary">
          Only do this if the meter was replaced or repaired. The owner has to approve it. You can keep working until then.
        </Text>
        <Button label="Send to owner" onPress={() => setSheet(false)} />
        <Button label="Keep 19,884.00" variant="secondary" onPress={() => setSheet(false)} />
      </BottomSheet>
    </>
  );
}
