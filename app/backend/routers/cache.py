"""缓存管理API路由"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.cache import cache_service
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

router = APIRouter(prefix="/api/v1/cache", tags=["cache"])


class CacheStatsResponse(BaseModel):
    backend: str
    initialized: bool
    keys: int
    used_memory: str


class ClearCacheResponse(BaseModel):
    success: bool
    message: str


@router.get("/stats", response_model=CacheStatsResponse)
async def get_cache_stats(
    current_user: UserResponse = Depends(get_current_user)
):
    """获取缓存统计信息"""
    try:
        stats = await cache_service.get_cache_stats()
        return CacheStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear", response_model=ClearCacheResponse)
async def clear_cache(
    current_user: UserResponse = Depends(get_current_user)
):
    """清空所有缓存（需要管理员权限）"""
    try:
        success = await cache_service.clear_all()
        return ClearCacheResponse(
            success=success,
            message="缓存已清空" if success else "清空缓存失败"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/stock/{ts_code}")
async def clear_stock_cache(
    ts_code: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """清除指定股票的缓存"""
    try:
        # 清除股票信息缓存
        await cache_service.delete(f"stock:info:{ts_code}")
        # 清除实时行情缓存
        await cache_service.delete(f"realtime:{ts_code}")
        # 清除K线缓存（需要遍历不同周期）
        for period in ["daily", "weekly", "monthly"]:
            await cache_service.delete(f"kline:{ts_code}:{period}")
        
        return {"success": True, "message": f"已清除 {ts_code} 的缓存"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))