"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { BoardCategory } from "@/features/board/types/board";
import { CATEGORY_LABEL } from "@/features/board/components/categoryLabels";

const CATEGORY_FILTER_ALL = "ALL" as const;

interface BoardCategoryFilterProps {
  value: BoardCategory | typeof CATEGORY_FILTER_ALL;
  onChange: (value: BoardCategory | typeof CATEGORY_FILTER_ALL) => void;
}

export function BoardCategoryFilter({ value, onChange }: BoardCategoryFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as BoardCategory | typeof CATEGORY_FILTER_ALL)}>
      <SelectTrigger className="w-[120px]">
        <SelectValue>{value === CATEGORY_FILTER_ALL ? "전체 카테고리" : CATEGORY_LABEL[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CATEGORY_FILTER_ALL}>전체 카테고리</SelectItem>
        <SelectItem value="NOTICE">{CATEGORY_LABEL.NOTICE}</SelectItem>
        <SelectItem value="MANUAL">{CATEGORY_LABEL.MANUAL}</SelectItem>
        <SelectItem value="GENERAL">{CATEGORY_LABEL.GENERAL}</SelectItem>
      </SelectContent>
    </Select>
  );
}

export { CATEGORY_FILTER_ALL };
