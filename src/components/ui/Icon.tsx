import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Droplet,
  Flag,
  Gauge,
  History,
  IndianRupee,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  LockOpen,
  LogOut,
  MessageSquare,
  Minus,
  Pen,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Smartphone,
  TriangleAlert,
  Truck,
  Upload,
  User,
  Wallet,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { ColorName } from "@/theme/theme";

/** Names follow the design canvas icon set (ph.css `.i-*`). Lucide outline, 1.5 px stroke. */
const icons = {
  lock: Lock,
  unlock: LockOpen,
  check: Check,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  warning: TriangleAlert,
  error: CircleAlert,
  close: X,
  plus: Plus,
  minus: Minus,
  clock: Clock,
  history: History,
  edit: Pen,
  today: ClipboardCheck,
  truck: Truck,
  bell: Bell,
  user: User,
  dashboard: LayoutDashboard,
  upload: Upload,
  message: MessageSquare,
  offline: WifiOff,
  signOut: LogOut,
  calendar: Calendar,
  search: Search,
  info: Info,
  arrowRight: ArrowRight,
  retry: RefreshCw,
  drop: Droplet,
  sliders: SlidersHorizontal,
  send: Send,
  rupee: IndianRupee,
  wallet: Wallet,
  flag: Flag,
  gauge: Gauge,
  phone: Smartphone,
  spinner: LoaderCircle,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

const sizes = { small: 16, inline: 20, nav: 24, large: 32 } as const;

export type IconProps = {
  name: IconName;
  size?: keyof typeof sizes;
  color?: ColorName;
};

export function Icon({ name, size = "inline", color = "text-primary" }: IconProps) {
  const { colors } = useTheme();
  const Component = icons[name];
  return <Component size={sizes[size]} color={colors[color]} strokeWidth={1.5} />;
}
