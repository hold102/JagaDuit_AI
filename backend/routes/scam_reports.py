from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.community_intelligence import list_scam_reports, store_scam_report

router = APIRouter()


class ScamReportRequest(BaseModel):
    evidenceSource: str = Field(default="other", max_length=80)
    scamType: str = Field(default="other", max_length=80)
    riskLevel: str = Field(default="", max_length=40)
    riskScore: int = Field(default=0, ge=0, le=100)
    detectedIndicators: List[str] = Field(default_factory=list)
    anonymizedSummary: str = Field(default="", max_length=1000)
    amountRange: str = Field(default="", max_length=80)
    paymentContext: str = Field(default="", max_length=120)
    userAction: str = Field(default="not_specified", max_length=80)


@router.post("/scam-reports")
def create_scam_report(req: ScamReportRequest):
    store_scam_report(req.model_dump())
    return {
        "success": True,
        "message": "Anonymous scam report submitted successfully.",
    }


@router.get("/scam-reports")
def get_scam_reports():
    return {
        "success": True,
        "reports": list_scam_reports(),
        "note": "Prototype demo storage. Reports are sanitized and do not contain raw secrets.",
    }
