from typing import List, Optional
from pydantic import BaseModel, Field


class ResumeData(BaseModel):
    candidate_name: str = Field(..., description="Full legal name of candidate")
    email: Optional[str] = Field(default=None, description="Contact email")
    phone: Optional[str] = Field(default=None, description="Contact phone")
    skills: List[str] = Field(default_factory=list, description="Extracted skills and technologies")
    education: List[str] = Field(default_factory=list, description="Degrees and universities")
    experience_years: Optional[float] = Field(default=0.0, description="Estimated years of experience")
    summary: Optional[str] = Field(default=None, description="Executive summary")
