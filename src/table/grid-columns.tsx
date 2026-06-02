import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { DownloadRow } from "../data/types";
import { Tooltip } from "../ui/tooltip";

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

const detailsRenderer = (
  params: ICellRendererParams<DownloadRow>,
  onDetails: (row: DownloadRow) => void,
) => {
  if (!params.data) {
    return null;
  }

  return (
    <Tooltip content="View download details">
      {(tooltipProps) => (
        <button
          {...tooltipProps}
          className="grid-details-button"
          onClick={() => onDetails(params.data!)}
          type="button"
        >
          Details
        </button>
      )}
    </Tooltip>
  );
};

export const createGridColumns = (
  onDetails: (row: DownloadRow) => void,
): ColDef<DownloadRow>[] => [
  {
    field: "category",
    headerName: "Category",
    hide: true,
    maxWidth: 136,
    tooltipField: "category",
  },
  {
    field: "name",
    headerName: "Name",
    hide: true,
    maxWidth: 256,
    tooltipField: "name",
  },
  {
    field: "description",
    headerName: "Description",
    minWidth: 384,
    tooltipField: "description",
  },
  {
    field: "productFamily",
    headerName: "Prod Family",
    maxWidth: 128,
    tooltipField: "productFamily",
  },
  {
    field: "productVersion",
    headerName: "Prod Version",
    maxWidth: 128,
    tooltipField: "productVersion",
  },
  {
    field: "platform",
    headerName: "Platform",
    maxWidth: 248,
    tooltipField: "platform",
  },
  {
    field: "platformVersion",
    headerName: "Platform Version",
    maxWidth: 144,
    tooltipField: "platformVersion",
  },
  {
    field: "releaseDate",
    headerName: "Release Date",
    maxWidth: 136,
    sort: "desc",
    tooltipField: "releaseDate",
    valueFormatter: ({ value }) => formatReleaseDate(String(value ?? "")),
  },
  {
    field: "type",
    headerName: "Type",
    hide: true,
    maxWidth: 136,
    tooltipField: "type",
  },
  {
    cellRenderer: (params: ICellRendererParams<DownloadRow>) =>
      detailsRenderer(params, onDetails),
    colId: "actions",
    filter: false,
    headerName: "Actions",
    maxWidth: 96,
    sortable: false,
  },
];
