import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ToolReturns } from "@/app/(chat)/api/chat/route";

interface GenericTableProps {
  res: ToolReturns["getData"];
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  // if its a number, format it with commas
  if (typeof value === "bigint" || typeof value === "number") {
    return value.toLocaleString();
  }
  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}

export function GenericTable({ res }: GenericTableProps) {
  const { data, sql, query, dataset } = res;

  if (!data || data.length === 0) {
    return <p>No data available</p>;
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="w-full overflow-y-auto max-h-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column}>
                  {formatCellValue(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
