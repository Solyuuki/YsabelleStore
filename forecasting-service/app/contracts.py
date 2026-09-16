from __future__ import annotations

from typing import Any, NotRequired, TypedDict


class HistoricalSalesPoint(TypedDict):
    productId: str
    productName: str
    category: str
    sellingPrice: float
    period: str
    quantitySold: int


class ForecastModelHint(TypedDict):
    order: list[int]
    seasonalOrder: list[int]


class ProductSeries(TypedDict):
    productId: str
    productName: str
    category: str
    sellingPrice: float
    historical: list[HistoricalSalesPoint]
    comparisonHistorical: NotRequired[list[HistoricalSalesPoint]]
    modelHint: NotRequired[ForecastModelHint]


class ForecastRequest(TypedDict):
    products: list[ProductSeries]
    horizon: int
    seasonalPeriod: int
    forecastStartPeriod: str


JsonDict = dict[str, Any]
