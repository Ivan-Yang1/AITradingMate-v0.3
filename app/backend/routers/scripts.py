"""交易脚本API路由"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import logging

from services.script_service import script_service
from services.notification_service import notification_service
from dependencies.auth import get_optional_user
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/scripts", tags=["scripts"])


class GenerateScriptRequest(BaseModel):
    stock_code: str
    stock_name: str
    user_input: str
    script_type: str = "python"  # python or pinescript


class GenerateScriptResponse(BaseModel):
    success: bool
    monitor_id: str
    script_type: str
    script: str
    intent: Dict[str, Any]
    conditions: List[str]
    message: str


class ActivateMonitorRequest(BaseModel):
    monitor_id: str
    monitor_data: Dict[str, Any]


class CheckMonitorRequest(BaseModel):
    monitor_id: str
    kline_data: List[Dict[str, Any]]


class MonitorStatus(BaseModel):
    id: str
    stock_code: str
    stock_name: str
    status: str
    conditions: List[str]
    created_at: str
    last_check: Optional[str]
    trigger_count: int


class NotificationSettingsRequest(BaseModel):
    browser_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    email_address: Optional[str] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    notification_types: Optional[Dict[str, bool]] = None


class TestNotificationRequest(BaseModel):
    notification_type: str  # "browser" or "email"
    title: Optional[str] = "测试通知"
    body: Optional[str] = "这是一条测试通知"


# 存储用户的监控任务
user_monitors: Dict[str, Dict[str, Any]] = {}


@router.post("/generate", response_model=GenerateScriptResponse)
async def generate_script(
    request: GenerateScriptRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """根据用户输入生成交易脚本"""
    try:
        # 创建监控任务
        monitor = script_service.create_monitor(
            stock_code=request.stock_code,
            stock_name=request.stock_name,
            user_input=request.user_input,
            script_type=request.script_type
        )
        
        # 存储到用户监控列表
        user_id = current_user.id if current_user else "anonymous"
        if user_id not in user_monitors:
            user_monitors[user_id] = {}
        user_monitors[user_id][monitor['id']] = monitor
        
        return GenerateScriptResponse(
            success=True,
            monitor_id=monitor['id'],
            script_type=monitor['script_type'],
            script=monitor['script'],
            intent=monitor['intent'],
            conditions=monitor['intent'].get('conditions', []),
            message=f"已生成{request.stock_name}的监控脚本"
        )
        
    except Exception as e:
        logger.error(f"Generate script error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activate")
async def activate_monitor(
    request: ActivateMonitorRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """激活监控任务"""
    try:
        user_id = current_user.id if current_user else "anonymous"
        
        # 获取监控任务
        if user_id in user_monitors and request.monitor_id in user_monitors[user_id]:
            monitor = user_monitors[user_id][request.monitor_id]
        else:
            monitor = request.monitor_data
        
        # 激活监控
        success = script_service.activate_monitor(request.monitor_id, monitor)
        
        if success:
            return {
                "success": True,
                "message": f"监控已激活: {monitor.get('stock_name', '')}",
                "monitor_id": request.monitor_id
            }
        else:
            raise HTTPException(status_code=400, detail="激活监控失败")
            
    except Exception as e:
        logger.error(f"Activate monitor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deactivate/{monitor_id}")
async def deactivate_monitor(
    monitor_id: str,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """停止监控任务"""
    try:
        success = script_service.deactivate_monitor(monitor_id)
        
        # 同时从用户监控列表中更新状态
        user_id = current_user.id if current_user else "anonymous"
        if user_id in user_monitors and monitor_id in user_monitors[user_id]:
            user_monitors[user_id][monitor_id]['status'] = 'stopped'
        
        return {
            "success": success,
            "message": "监控已停止" if success else "监控不存在",
            "monitor_id": monitor_id
        }
        
    except Exception as e:
        logger.error(f"Deactivate monitor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monitors")
async def get_monitors(
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """获取用户的所有监控任务"""
    try:
        user_id = current_user.id if current_user else "anonymous"
        monitors = user_monitors.get(user_id, {})
        
        # 合并活跃监控的状态
        active_monitors = {m['id']: m for m in script_service.get_active_monitors()}
        
        result = []
        for monitor_id, monitor in monitors.items():
            if monitor_id in active_monitors:
                monitor = {**monitor, **active_monitors[monitor_id]}
            result.append({
                "id": monitor['id'],
                "stock_code": monitor['stock_code'],
                "stock_name": monitor['stock_name'],
                "status": monitor['status'],
                "conditions": monitor['intent'].get('conditions', []),
                "created_at": monitor['created_at'],
                "last_check": monitor.get('last_check'),
                "trigger_count": monitor.get('trigger_count', 0),
            })
        
        return {
            "success": True,
            "monitors": result,
            "total": len(result)
        }
        
    except Exception as e:
        logger.error(f"Get monitors error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check")
async def check_monitor(
    request: CheckMonitorRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """检查监控条件是否触发"""
    try:
        result = script_service.check_monitor(
            monitor_id=request.monitor_id,
            kline_data=request.kline_data
        )
        
        if result:
            # 发送通知
            user_id = current_user.id if current_user else "anonymous"
            notification_result = notification_service.send_monitor_alert(
                user_id=user_id,
                monitor_data=result,
                alerts=result.get('alerts', [])
            )
            
            return {
                "success": True,
                "triggered": True,
                "result": result,
                "notification": notification_result
            }
        else:
            return {
                "success": True,
                "triggered": False,
                "message": "未触发监控条件"
            }
            
    except Exception as e:
        logger.error(f"Check monitor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates")
async def get_indicator_templates():
    """获取可用的指标模板"""
    return {
        "success": True,
        "templates": script_service.INDICATOR_TEMPLATES,
        "script_types": script_service.SCRIPT_TYPES
    }


# ==================== 通知设置相关API ====================

@router.get("/notification/settings")
async def get_notification_settings(
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """获取用户通知设置"""
    user_id = current_user.id if current_user else "anonymous"
    settings = notification_service.get_user_settings(user_id)
    return {
        "success": True,
        "settings": settings
    }


@router.post("/notification/settings")
async def update_notification_settings(
    request: NotificationSettingsRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """更新用户通知设置"""
    user_id = current_user.id if current_user else "anonymous"
    
    # 构建更新数据
    update_data = {}
    if request.browser_enabled is not None:
        update_data["browser_enabled"] = request.browser_enabled
    if request.email_enabled is not None:
        update_data["email_enabled"] = request.email_enabled
    if request.email_address is not None:
        update_data["email_address"] = request.email_address
    if request.quiet_hours_start is not None:
        update_data["quiet_hours_start"] = request.quiet_hours_start
    if request.quiet_hours_end is not None:
        update_data["quiet_hours_end"] = request.quiet_hours_end
    if request.notification_types is not None:
        update_data["notification_types"] = request.notification_types
    
    settings = notification_service.update_user_settings(user_id, update_data)
    return {
        "success": True,
        "settings": settings,
        "message": "通知设置已更新"
    }


@router.post("/notification/test")
async def test_notification(
    request: TestNotificationRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """发送测试通知"""
    user_id = current_user.id if current_user else "anonymous"
    
    if request.notification_type == "browser":
        result = notification_service.send_browser_notification(
            user_id=user_id,
            title=request.title or "测试通知",
            body=request.body or "这是一条测试通知，用于验证浏览器通知功能是否正常工作。",
            data={"type": "test"}
        )
    elif request.notification_type == "email":
        result = notification_service.send_email_notification(
            user_id=user_id,
            subject=request.title or "【AI金融助手】测试邮件",
            body=request.body or "这是一条测试邮件，用于验证邮件通知功能是否正常工作。"
        )
    else:
        raise HTTPException(status_code=400, detail="无效的通知类型")
    
    return {
        "success": result.get("success", False),
        "result": result
    }


@router.get("/notification/history")
async def get_notification_history(
    limit: int = 50,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """获取通知历史"""
    user_id = current_user.id if current_user else "anonymous"
    history = notification_service.get_notification_history(user_id, limit)
    return {
        "success": True,
        "history": history,
        "total": len(history)
    }


@router.delete("/notification/history")
async def clear_notification_history(
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """清除通知历史"""
    user_id = current_user.id if current_user else "anonymous"
    notification_service.clear_notification_history(user_id)
    return {
        "success": True,
        "message": "通知历史已清除"
    }


@router.post("/ai-generate")
async def ai_generate_script(
    request: GenerateScriptRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user)
):
    """使用AI生成更智能的脚本（流式响应）"""
    
    async def generate():
        try:
            # 解析用户意图
            intent = script_service.parse_user_intent(request.user_input)
            
            # 发送解析结果
            yield f"data: {json.dumps({'type': 'intent', 'data': intent}, ensure_ascii=False)}\n\n"
            
            # 生成脚本
            if request.script_type == 'pinescript':
                script = script_service.generate_pinescript(
                    request.stock_code, 
                    request.stock_name, 
                    intent
                )
            else:
                script = script_service.generate_python_script(
                    request.stock_code, 
                    request.stock_name, 
                    intent
                )
            
            # 创建监控任务
            monitor = {
                'id': f"{request.stock_code}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                'stock_code': request.stock_code,
                'stock_name': request.stock_name,
                'user_input': request.user_input,
                'intent': intent,
                'script_type': request.script_type,
                'script': script,
                'status': 'pending',
                'created_at': datetime.now().isoformat(),
                'last_check': None,
                'trigger_count': 0,
            }
            
            # 存储监控任务
            user_id = current_user.id if current_user else "anonymous"
            if user_id not in user_monitors:
                user_monitors[user_id] = {}
            user_monitors[user_id][monitor['id']] = monitor
            
            # 发送脚本
            yield f"data: {json.dumps({'type': 'script', 'data': {'monitor_id': monitor['id'], 'script': script, 'script_type': request.script_type}}, ensure_ascii=False)}\n\n"
            
            # 发送完成信号
            yield f"data: {json.dumps({'type': 'done', 'data': {'monitor_id': monitor['id'], 'conditions': intent.get('conditions', [])}}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            logger.error(f"AI generate script error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )