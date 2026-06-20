"use client";

import { useStore } from "../../components/StoreProvider";
import Board from "../../components/Board";
import Loading from "../../components/Loading";

export default function LivePage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <Board
      posts={data.liveNotes}
      mutate={(recipe) => update((d) => recipe(d.liveNotes))}
      help={
        <>
          방송에서 나온 <b>긴급·중요 내용</b>을 빠르게 정리하는 곳이에요. <b>내용</b>에 <b>유튜브·mp4·숲(SOOP) VOD·사진 링크</b>를 적거나 사진을 <b>Ctrl+V</b>로 붙여넣으면 글 안 <b>그 자리에</b> 바로 표시돼요. 글은 <b>쓴 순서대로</b> 쌓여요.
        </>
      }
    />
  );
}
