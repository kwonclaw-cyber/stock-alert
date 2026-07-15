import { redirect } from "next/navigation";

// 멤버현황 탭 삭제 → 루트는 내실현황판으로 보낸다.
export default function Home() {
  redirect("/baksajang");
}
