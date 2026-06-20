"use client";

import { useStore } from "../../components/StoreProvider";
import Board from "../../components/Board";
import Loading from "../../components/Loading";

export default function InfoPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <Board
      posts={data.infos}
      mutate={(recipe) => update((d) => recipe(d.infos))}
      help={
        <>
          서버 <b>공략·꿀팁·공지</b>를 자유롭게 공유하는 게시판이에요. <b>내용</b>에 <b>유튜브·mp4·숲(SOOP) VOD·사진 링크</b>를 적거나 사진을 <b>Ctrl+V</b>로 붙여넣으면 글 안 <b>그 자리에</b> 바로 표시돼요. 글은 <b>쓴 순서대로</b> 쌓이고, 내용이 길어지면 카드도 늘어나요.
        </>
      }
    />
  );
}
