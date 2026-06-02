import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { DownloadRow } from "../data/types";
import { DownloadActions, type DownloadActionPanel } from "../ui/download-actions";

export type GridColumnOption = {
  field: keyof DownloadRow;
  label: string;
  defaultVisible: boolean;
};

export const gridColumnOptions: GridColumnOption[] = [
  { defaultVisible: false, field: "category", label: "Category" },
  { defaultVisible: false, field: "name", label: "Name" },
  { defaultVisible: true, field: "description", label: "Description" },
  { defaultVisible: true, field: "productFamily", label: "Product Family" },
  { defaultVisible: true, field: "productVersion", label: "Product Version" },
  { defaultVisible: true, field: "platform", label: "Platform" },
  { defaultVisible: true, field: "platformVersion", label: "Platform Version" },
  { defaultVisible: true, field: "releaseDate", label: "Release Date" },
  { defaultVisible: false, field: "type", label: "Type" },
];

const formatReleaseDate = (date: string) => {
  if (!date) {
    return "";
  }

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const actionsRenderer = (
  params: ICellRendererParams<DownloadRow>,
  onOpenPanel: (row: DownloadRow, panel: DownloadActionPanel) => void,
) => {
  if (!params.data) {
    return null;
  }

  return <DownloadActions onOpenPanel={onOpenPanel} row={params.data} />;
};

export const createGridColumns = (
  onOpenPanel: (row: DownloadRow, panel: DownloadActionPanel) => void,
): ColDef<DownloadRow>[] => [
  {
    field: "category",
    flex: 2,
    headerName: "Category",
    hide: true,
    minWidth: 96,
    tooltipField: "category",
  },
  {
    field: "name",
    flex: 3,
    headerName: "Name",
    hide: true,
    minWidth: 220,
    tooltipField: "name",
  },
  {
    field: "description",
    flex: 5,
    headerName: "Description",
    minWidth: 360,
    tooltipField: "description",
  },
  {
    field: "productFamily",
    flex: 2,
    headerName: "Prod Family",
    minWidth: 120,
    tooltipField: "productFamily",
  },
  {
    field: "productVersion",
    flex: 2,
    headerName: "Prod Version",
    minWidth: 120,
    tooltipField: "productVersion",
  },
  {
    field: "platform",
    flex: 3,
    headerName: "Platform",
    minWidth: 180,
    tooltipField: "platform",
  },
  {
    field: "platformVersion",
    flex: 2,
    headerName: "Platform Version",
    minWidth: 150,
    tooltipField: "platformVersion",
  },
  {
    field: "releaseDate",
    flex: 2,
    headerName: "Release Date",
    minWidth: 132,
    sort: "desc",
    tooltipField: "releaseDate",
    valueFormatter: ({ value }) => formatReleaseDate(String(value ?? "")),
  },
  {
    field: "type",
    flex: 2,
    headerName: "Type",
    hide: true,
    minWidth: 120,
    tooltipField: "type",
  },
  {
    cellRenderer: (params: ICellRendererParams<DownloadRow>) =>
      actionsRenderer(params, onOpenPanel),
    colId: "actions",
    flex: 2,
    filter: false,
    headerName: "Actions",
    minWidth: 150,
    sortable: false,
  },
];
