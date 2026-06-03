import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  GitPullRequest,
  Languages,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ColumnVisibilityMenu } from "../ui/column-visibility-menu";
import { FiltersPanel } from "../ui/filters-panel";
import { Tooltip } from "../ui/tooltip";
import { defaultLocale, locales, type Locale } from "../i18n/resources";
import {
  type FilterChip,
  type FilterKey,
  type MultiFiltersState,
  type SearchScopeKey,
  type TextFilter,
  filterConfigs,
  textFilterConfigs,
} from "./filters";
import type { GridColumnOption } from "./grid-columns";

type DownloadsToolbarProps = {
  activeFilterChips: FilterChip[];
  activeFilterKey: FilterKey | null;
  columnMenuOpen: boolean;
  columnOptions: GridColumnOption[];
  filterMenuOpen: boolean;
  filters: MultiFiltersState;
  filterOptions: Record<FilterKey, string[]>;
  globalSearch: string;
  hasClearableSearch: boolean;
  loading: boolean;
  searchControlRef: RefObject<HTMLFormElement | null>;
  searchInput: string;
  searchScope: SearchScopeKey;
  searchScopeLabel: string;
  textFilters: TextFilter[];
  visibleColumns: Record<string, boolean>;
  onClearAll: () => void;
  onClearFilterKey: (key: FilterKey) => void;
  onClearGlobalSearch: () => void;
  onClearTextFilter: (key: TextFilter["key"]) => void;
  onColumnMenuClose: () => void;
  onColumnMenuToggle: () => void;
  onColumnVisibilityChange: (field: string, visible: boolean) => void;
  onCommitSearch: () => void;
  onExport: () => void;
  onFilterChange: (filters: MultiFiltersState) => void;
  onFilterMenuToggle: () => void;
  onReload: () => void;
  onSearchInputChange: (value: string) => void;
  onSearchScopeSelect: (key: SearchScopeKey) => void;
  onSetActiveFilterKey: (key: FilterKey | null) => void;
};

export function DownloadsToolbar({
  activeFilterChips,
  activeFilterKey,
  columnMenuOpen,
  columnOptions,
  filterMenuOpen,
  filters,
  filterOptions,
  globalSearch,
  hasClearableSearch,
  loading,
  searchControlRef,
  searchInput,
  searchScope,
  searchScopeLabel,
  textFilters,
  visibleColumns,
  onClearAll,
  onClearFilterKey,
  onClearGlobalSearch,
  onClearTextFilter,
  onColumnMenuClose,
  onColumnMenuToggle,
  onColumnVisibilityChange,
  onCommitSearch,
  onExport,
  onFilterChange,
  onFilterMenuToggle,
  onReload,
  onSearchInputChange,
  onSearchScopeSelect,
  onSetActiveFilterKey,
}: DownloadsToolbarProps) {
  const { i18n, t } = useTranslation();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const filterLabel = (key: FilterKey) =>
    t(filterConfigs.find((config) => config.key === key)?.labelKey ?? "");
  const textFilterLabel = (key: TextFilter["key"]) =>
    t(textFilterConfigs.find((config) => config.key === key)?.labelKey ?? "");
  const activeLocale = locales.includes(i18n.language as Locale)
    ? (i18n.language as Locale)
    : "en";
  const changeLanguage = (locale: Locale) => {
    if (locale === defaultLocale) {
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
    } else {
      window.location.hash = locale;
    }

    void i18n.changeLanguage(locale);
    setLanguageMenuOpen(false);
  };

  useEffect(() => {
    if (!languageMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const root = languageMenuRef.current;

      if (!root || root.contains(event.target as Node)) {
        return;
      }

      setLanguageMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [languageMenuOpen]);

  return (
    <section aria-label="Toolbar" className="table-toolbar">
      <form
        className={[
          "search-control",
          filterMenuOpen || hasClearableSearch || searchScope !== "global"
            ? "search-control--active"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={searchControlRef}
        onSubmit={(event) => {
          event.preventDefault();
          onCommitSearch();
        }}
      >
        <Tooltip content={t("actions.openFilters")}>
          {(tooltipProps) => (
            <button
              {...tooltipProps}
              className="search-control__filter-trigger"
              onClick={onFilterMenuToggle}
              type="button"
            >
              <SlidersHorizontal
                aria-hidden="true"
                className="search-control__filter-icon"
                size={26}
              />
            </button>
          )}
        </Tooltip>

        <FiltersPanel
          activeFilterKey={activeFilterKey}
          activeSearchScope={searchScope}
          filters={filters}
          onChange={onFilterChange}
          onHoverField={onSetActiveFilterKey}
          onSelectSearchScope={onSearchScopeSelect}
          open={filterMenuOpen}
          options={filterOptions}
        />

        {activeFilterChips.map((chip) => (
          <button
            className="search-chip"
            key={chip.key}
            onClick={() => onClearFilterKey(chip.key)}
            type="button"
          >
            <span>
              {filterLabel(chip.key)}:{" "}
              {chip.selectedValue || t("filters.valueCount", { count: chip.selectedCount })}
            </span>
            <X aria-hidden="true" size={16} />
          </button>
        ))}

        {globalSearch ? (
          <button
            className="search-chip search-chip--global"
            onClick={onClearGlobalSearch}
            type="button"
          >
            <span>{t("filters.global")}: {globalSearch}</span>
            <X aria-hidden="true" size={16} />
          </button>
        ) : null}

        {textFilters.map((filter) => (
          <button
            className="search-chip"
            key={filter.key}
            onClick={() => onClearTextFilter(filter.key)}
            type="button"
          >
            <span>
              {textFilterLabel(filter.key)}: {filter.value}
            </span>
            <X aria-hidden="true" size={16} />
          </button>
        ))}

        <input
          className="search-control__input"
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder={
            searchScope === "global"
              ? t("filters.search")
              : t("filters.searchBy", { field: searchScopeLabel })
          }
          type="search"
          value={searchInput}
        />

        {hasClearableSearch ? (
          <Tooltip content={t("filters.clearFilters")}>
            {(tooltipProps) => (
              <button
                {...tooltipProps}
                className="search-control__clear"
                onClick={onClearAll}
                type="button"
              >
                <X aria-hidden="true" size={32} />
              </button>
            )}
          </Tooltip>
        ) : null}
      </form>

      <div className="toolbar-actions">
        <Tooltip content={t("actions.refreshData")}>
          {(tooltipProps) => (
            <button
              {...tooltipProps}
              className="icon-button"
              disabled={loading}
              onClick={onReload}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              <span>{t("actions.reload")}</span>
            </button>
          )}
        </Tooltip>

        <Tooltip content={t("actions.exportCsv")}>
          {(tooltipProps) => (
            <button
              {...tooltipProps}
              className="icon-button"
              onClick={onExport}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              <span>{t("actions.exportCsv")}</span>
            </button>
          )}
        </Tooltip>

        <ColumnVisibilityMenu
          columns={columnOptions}
          onClose={onColumnMenuClose}
          onToggle={onColumnMenuToggle}
          onVisibilityChange={onColumnVisibilityChange}
          open={columnMenuOpen}
          visibleColumns={visibleColumns}
        />

        <div className="toolbar-language" ref={languageMenuRef}>
          <Tooltip content={t("actions.language")}>
            {(tooltipProps) => (
              <button
                {...tooltipProps}
                aria-expanded={languageMenuOpen}
                className="icon-button"
                onClick={() => setLanguageMenuOpen((open) => !open)}
                type="button"
              >
                <Languages aria-hidden="true" size={20} />
              </button>
            )}
          </Tooltip>

          {languageMenuOpen ? (
            <div className="toolbar-language__menu" role="menu">
              {locales.map((locale) => (
                <button
                  aria-current={locale === activeLocale ? "true" : undefined}
                  className="toolbar-language__item"
                  key={locale}
                  onClick={() => changeLanguage(locale)}
                  type="button"
                >
                  {t(`localeNames.${locale}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Tooltip content={t("actions.openGithubRepo")}>
          {(tooltipProps) => (
            <a
              {...tooltipProps}
              className="icon-button"
              href="https://github.com/nvidiavgpuarchive/index"
              rel="noreferrer"
              target="_blank"
            >
              <GitPullRequest aria-hidden="true" size={16} />
              <span>{t("actions.github")}</span>
            </a>
          )}
        </Tooltip>
      </div>
    </section>
  );
}
