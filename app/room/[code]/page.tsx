import Game from "./Game";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Game code={code.toUpperCase().slice(0, 12)} />;
}
