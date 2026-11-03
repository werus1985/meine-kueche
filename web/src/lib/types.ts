export type FormState = {
  ok: boolean;
  message: string;
  inviteUrl?: string;
} | null;

export type RoleKey = "owner" | "editor" | "viewer";

export type RecipeIngredient = {
  name: string;
  qty: number | null;
  unit: string | null;
  optional: boolean;
};

export type RecipeStep = {
  text: string;
};

export type Recipe = {
  id: string;
  household_id: string;
  title: string;
  description: string;
  servings: number;
  source: "manual" | "chat" | "link" | "photo";
  source_url: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeWithDetails = Recipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  photoUrl?: string | null;
};

export type HouseholdSummary = {
  id: string;
  name: string;
  role: RoleKey;
  canWrite: boolean;
  canManageMembers: boolean;
  canManageHousehold: boolean;
};

export type KitchenProduct = {
  id: string;
  household_id: string;
  barcode: string | null;
  name: string;
  category_id: string | null;
  unit_id: string | null;
  last_location_id: string | null;
  photo_path: string | null;
  seasonal: boolean;
  created_at: string;
  updated_at: string;
  photoUrl?: string | null;
  itemCount?: number;
  stockItemCount?: number;
};

export const ROLE_OPTIONS: { value: RoleKey; label: string }[] = [
  { value: "viewer", label: "Nur Lesen" },
  { value: "editor", label: "Bearbeiter" },
  { value: "owner", label: "Eigentümer" },
];

export function permissionsForRole(role: string) {
  switch (role) {
    case "owner":
      return {
        canWrite: true,
        canManageMembers: true,
        canManageHousehold: true,
      };
    case "editor":
      return {
        canWrite: true,
        canManageMembers: false,
        canManageHousehold: false,
      };
    default:
      return {
        canWrite: false,
        canManageMembers: false,
        canManageHousehold: false,
      };
  }
}
