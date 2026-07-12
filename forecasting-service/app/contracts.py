from __future__ import annotations

from typing import Any, TypedDict


class HistoricalSalesPoint(TypedDict):
    productId: str
    productName: str
    category: str
    sellingPrice: float
    period: str
    quantitySold: int


class ProductSeries(TypedDict):
    productId: str
    productName: str
    category: str
    sellingPrice: float
    historical: list[HistoricalSalesPoint]


class ForecastRequest(TypedDict):
    products: list[ProductSeries]
    horizon: int
    seasonalPeriod: int
    forecastStartPeriod: str


JsonDict = dict[str, Any]
