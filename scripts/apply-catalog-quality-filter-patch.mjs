import fs from "node:fs";

const filePath = "frontend/src/pages/ProductsPage.tsx";
let source = fs.readFileSync(filePath, "utf8");

function replaceOnce(label, before, after) {
  const index = source.indexOf(before);
  if (index === -1) {
    if (source.includes(after)) {
      return;
    }
    throw new Error(`Catalog quality filter patch failed at: ${label}`);
  }
  if (source.indexOf(before, index + before.length) !== -1) {
    throw new Error(`Catalog quality filter patch is ambiguous at: ${label}`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(
  "quality filter state",
  '  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");\n  const [page, setPage] = useState(1);',
  '  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");\n  const [qualityFilter, setQualityFilter] = useState<"ALL" | ProductRecord["dataQualityStatus"]>(\n    "ALL"\n  );\n  const [page, setPage] = useState(1);'
);

replaceOnce(
  "current catalog view ref",
  '  const currentCatalogViewRef = useRef({\n    debouncedSearch: "",\n    page: 1,\n    pageSize: DEFAULT_PAGE_SIZE,\n    statusFilter: "ALL" as typeof statusFilter\n  });',
  '  const currentCatalogViewRef = useRef({\n    debouncedSearch: "",\n    page: 1,\n    pageSize: DEFAULT_PAGE_SIZE,\n    qualityFilter: "ALL" as typeof qualityFilter,\n    statusFilter: "ALL" as typeof statusFilter\n  });'
);

replaceOnce(
  "previous catalog params type",
  '  const previousCatalogParamsRef = useRef<{\n    debouncedSearch: string;\n    page: number;\n    pageSize: number;\n    statusFilter: typeof statusFilter;\n    initialized: boolean;\n  }>({\n    debouncedSearch: "",\n    page: 1,\n    pageSize: DEFAULT_PAGE_SIZE,\n    statusFilter: "ALL",\n    initialized: false\n  });',
  '  const previousCatalogParamsRef = useRef<{\n    debouncedSearch: string;\n    page: number;\n    pageSize: number;\n    qualityFilter: typeof qualityFilter;\n    statusFilter: typeof statusFilter;\n    initialized: boolean;\n  }>({\n    debouncedSearch: "",\n    page: 1,\n    pageSize: DEFAULT_PAGE_SIZE,\n    qualityFilter: "ALL",\n    statusFilter: "ALL",\n    initialized: false\n  });'
);

replaceOnce(
  "current catalog view effect",
  '    currentCatalogViewRef.current = {\n      debouncedSearch,\n      page,\n      pageSize,\n      statusFilter\n    };\n  }, [debouncedSearch, page, pageSize, statusFilter]);',
  '    currentCatalogViewRef.current = {\n      debouncedSearch,\n      page,\n      pageSize,\n      qualityFilter,\n      statusFilter\n    };\n  }, [debouncedSearch, page, pageSize, qualityFilter, statusFilter]);'
);

replaceOnce(
  "load catalog options",
  '    pageSize: number;\n    search: string;\n    status: typeof statusFilter;\n  }) {',
  '    pageSize: number;\n    quality: typeof qualityFilter;\n    search: string;\n    status: typeof statusFilter;\n  }) {'
);

replaceOnce(
  "fetch products query",
  '            page: options.page,\n            pageSize: options.pageSize,\n            search: options.search.trim() || undefined,\n            status: options.status === "ALL" ? undefined : options.status',
  '            page: options.page,\n            pageSize: options.pageSize,\n            dataQualityStatus: options.quality === "ALL" ? undefined : options.quality,\n            search: options.search.trim() || undefined,\n            status: options.status === "ALL" ? undefined : options.status'
);

replaceOnce(
  "filter reason detection",
  '      } else if (statusFilter !== previous.statusFilter) {\n        reason = "filter";\n      } else if (pageSize !== previous.pageSize) {',
  '      } else if (\n        statusFilter !== previous.statusFilter ||\n        qualityFilter !== previous.qualityFilter\n      ) {\n        reason = "filter";\n      } else if (pageSize !== previous.pageSize) {'
);

replaceOnce(
  "previous catalog params assignment",
  '      debouncedSearch,\n      page,\n      pageSize,\n      statusFilter,\n      initialized: true',
  '      debouncedSearch,\n      page,\n      pageSize,\n      qualityFilter,\n      statusFilter,\n      initialized: true'
);

replaceOnce(
  "load catalog effect call",
  '      page,\n      pageSize,\n      search: debouncedSearch,\n      status: statusFilter\n    });\n  }, [debouncedSearch, page, pageSize, statusFilter]);',
  '      page,\n      pageSize,\n      quality: qualityFilter,\n      search: debouncedSearch,\n      status: statusFilter\n    });\n  }, [debouncedSearch, page, pageSize, qualityFilter, statusFilter]);'
);

replaceOnce(
  "refresh catalog quality",
  '      page,\n      pageSize,\n      search: debouncedSearch,\n      status: statusFilter\n    });\n  }\n\n  function resetImportFlow()',
  '      page,\n      pageSize,\n      quality: qualityFilter,\n      search: debouncedSearch,\n      status: statusFilter\n    });\n  }\n\n  function resetImportFlow()'
);

replaceOnce(
  "apply product filter destructure",
  '  function applyProductToCatalog(updatedProduct: ProductRecord) {\n    const { statusFilter: visibleStatusFilter, page: visiblePage } = currentCatalogViewRef.current;\n    const statusMatchesFilter =\n      visibleStatusFilter === "ALL" || updatedProduct.status === visibleStatusFilter;',
  '  function applyProductToCatalog(updatedProduct: ProductRecord) {\n    const {\n      qualityFilter: visibleQualityFilter,\n      statusFilter: visibleStatusFilter,\n      page: visiblePage\n    } = currentCatalogViewRef.current;\n    const statusMatchesFilter =\n      visibleStatusFilter === "ALL" || updatedProduct.status === visibleStatusFilter;\n    const qualityMatchesFilter =\n      visibleQualityFilter === "ALL" || updatedProduct.dataQualityStatus === visibleQualityFilter;\n    const productMatchesFilters = statusMatchesFilter && qualityMatchesFilter;'
);

replaceOnce(
  "apply product row filter",
  '      if (!statusMatchesFilter) {\n        return current.filter((product) => product.id !== updatedProduct.id);\n      }',
  '      if (!productMatchesFilters) {\n        return current.filter((product) => product.id !== updatedProduct.id);\n      }'
);

replaceOnce(
  "apply pagination filter",
  '      if (statusMatchesFilter) {\n        return current;\n      }',
  '      if (productMatchesFilters) {\n        return current;\n      }'
);

replaceOnce(
  "quality filter handler",
  '  function handleStatusFilterChange(value: typeof statusFilter) {\n    setStatusFilter(value);\n    setPage(1);\n    clearSelection();\n  }\n\n  function handlePageSizeChange',
  '  function handleStatusFilterChange(value: typeof statusFilter) {\n    setStatusFilter(value);\n    setPage(1);\n    clearSelection();\n  }\n\n  function handleQualityFilterChange(value: typeof qualityFilter) {\n    setQualityFilter(value);\n    setPage(1);\n    clearSelection();\n  }\n\n  function handlePageSizeChange'
);

replaceOnce(
  "filter grid",
  '              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">',
  '              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">'
);

replaceOnce(
  "quality filter dropdown",
  '                </label>\n              </div>\n              {catalogError ? (',
  '                </label>\n                <label className="relative flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm">\n                  <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />\n                  <select\n                    aria-busy={filterIsLoading}\n                    aria-label="Catalog quality"\n                    className={["w-full bg-transparent outline-none", filterIsLoading ? "pr-6" : ""]\n                      .filter(Boolean)\n                      .join(" ")}\n                    value={qualityFilter}\n                    onChange={(event) =>\n                      handleQualityFilterChange(event.target.value as typeof qualityFilter)\n                    }\n                  >\n                    <option value="ALL">All quality</option>\n                    <option value="NEEDS_REVIEW">Needs review</option>\n                    <option value="APPROVED">Approved</option>\n                    <option value="REJECTED">Rejected</option>\n                  </select>\n                  {filterIsLoading ? (\n                    <LoaderCircle className="pointer-events-none absolute right-3 h-4 w-4 animate-spin text-emerald-700" />\n                  ) : null}\n                </label>\n              </div>\n              {catalogError ? ('
);

fs.writeFileSync(filePath, source, "utf8");
console.log("Catalog quality filter patch applied.");
