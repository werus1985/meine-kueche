import { redirect } from "next/navigation";

export default async function ShoppingPage() {
  redirect("/items?kind=shop");
}
