import {
  Accessibility, Award, Baby, BadgeCheck, Car, CreditCard, Globe, Heart, Home, IdCard,
  Landmark, Mail, PiggyBank, Plane, Receipt, School, Shield, Sunset, Users, Vote,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  baby: Baby, home: Home, receipt: Receipt, school: School, heart: Heart, landmark: Landmark,
  shield: Shield, badge: BadgeCheck, vote: Vote, mail: Mail, idcard: IdCard, plane: Plane,
  card: CreditCard, car: Car, piggy: PiggyBank, award: Award, accessibility: Accessibility,
  users: Users, globe: Globe, sunset: Sunset,
};

export function CardIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? IdCard;
  return <Icon className={className} aria-hidden="true" />;
}
