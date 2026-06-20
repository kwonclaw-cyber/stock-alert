"use client";

import { useStore } from "../../components/StoreProvider";
import Board from "../../components/Board";
import Loading from "../../components/Loading";

export default function DwellingPage() {
  const { data, update } = useStore();
  if (!data) return <Loading />;

  return (
    <Board
      posts={data.dwellings}
      mutate={(recipe) => update((d) => recipe(d.dwellings))}
      help={
        <>
          <b>영단</b> 정보를 글로 정리하는 곳이에요. <b>내용</b>에 <b>사진·영상 링크</b>를 적거나 사진을 <b>Ctrl+V</b>로 붙여넣으면 글 안 <b>그 자리에</b> 바로 표시돼요. (수정 중인 탭이에요)
        </>
      }
    />
  );
}
