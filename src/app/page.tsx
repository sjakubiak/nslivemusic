import Finder from "@/components/Finder";
import { getAllEvents } from "@/lib/events-store";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Finder events={getAllEvents()} />;
}
