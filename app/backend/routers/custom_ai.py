"""
自定义AI API路由 - 支持用户自定义OpenAI兼容API
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["custom-ai"])


class TestApiRequest(BaseModel):
    base_url: str
    api_key: str
    model: str


class TestApiResponse(BaseModel):
    success: bool
    message: str
    model_info: Optional[dict] = None


class CustomChatRequest(BaseModel):
    message: str
    base_url: str
    api_key: str
    model: str
    temperature: float = 0.7
    max_tokens: int = 2048
    system_prompt: Optional[str] = None


class CustomChatResponse(BaseModel):
    success: bool
    content: str
    error: Optional[str] = None


@router.post("/test-custom-api", response_model=TestApiResponse)
async def test_custom_api(request: TestApiRequest):
    """测试自定义API连接"""
    try:
        # Normalize base URL
        base_url = request.base_url.rstrip('/')
        
        # Try to call the models endpoint to verify connection
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {request.api_key}",
                "Content-Type": "application/json"
            }
            
            # First try to list models
            try:
                models_response = await client.get(
                    f"{base_url}/models",
                    headers=headers
                )
                if models_response.status_code == 200:
                    models_data = models_response.json()
                    logger.info(f"Successfully connected to custom API: {base_url}")
                    return TestApiResponse(
                        success=True,
                        message="连接成功",
                        model_info={"available_models": len(models_data.get("data", []))}
                    )
            except Exception as e:
                logger.warning(f"Failed to list models: {e}, trying chat completion")
            
            # If models endpoint fails, try a simple chat completion
            chat_payload = {
                "model": request.model,
                "messages": [
                    {"role": "user", "content": "Hello, this is a test message. Please respond with 'OK'."}
                ],
                "max_tokens": 10,
                "temperature": 0
            }
            
            chat_response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=chat_payload
            )
            
            if chat_response.status_code == 200:
                response_data = chat_response.json()
                model_used = response_data.get("model", request.model)
                logger.info(f"Successfully tested chat completion with model: {model_used}")
                return TestApiResponse(
                    success=True,
                    message=f"连接成功，模型 {model_used} 可用",
                    model_info={"model": model_used}
                )
            else:
                error_detail = chat_response.text
                logger.error(f"Chat completion failed: {error_detail}")
                return TestApiResponse(
                    success=False,
                    message=f"API调用失败: {chat_response.status_code} - {error_detail[:200]}"
                )
                
    except httpx.TimeoutException:
        logger.error("Connection timeout")
        return TestApiResponse(
            success=False,
            message="连接超时，请检查API地址是否正确"
        )
    except httpx.ConnectError as e:
        logger.error(f"Connection error: {e}")
        return TestApiResponse(
            success=False,
            message="无法连接到API服务器，请检查地址是否正确"
        )
    except Exception as e:
        logger.error(f"Test API error: {e}")
        return TestApiResponse(
            success=False,
            message=f"测试失败: {str(e)}"
        )


@router.post("/custom-chat", response_model=CustomChatResponse)
async def custom_chat(
    request: CustomChatRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """使用自定义API进行对话"""
    try:
        base_url = request.base_url.rstrip('/')
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "Authorization": f"Bearer {request.api_key}",
                "Content-Type": "application/json"
            }
            
            messages = []
            if request.system_prompt:
                messages.append({"role": "system", "content": request.system_prompt})
            messages.append({"role": "user", "content": request.message})
            
            chat_payload = {
                "model": request.model,
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "stream": False
            }
            
            response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=chat_payload
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return CustomChatResponse(success=True, content=content)
            else:
                error_msg = response.text[:500]
                logger.error(f"Custom chat failed: {error_msg}")
                return CustomChatResponse(
                    success=False,
                    content="",
                    error=f"API调用失败: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        return CustomChatResponse(
            success=False,
            content="",
            error="请求超时"
        )
    except Exception as e:
        logger.error(f"Custom chat error: {e}")
        return CustomChatResponse(
            success=False,
            content="",
            error=str(e)
        )


@router.post("/custom-chat-stream")
async def custom_chat_stream(
    request: CustomChatRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """使用自定义API进行流式对话"""
    from fastapi.responses import StreamingResponse
    import json
    
    async def generate():
        try:
            base_url = request.base_url.rstrip('/')
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                headers = {
                    "Authorization": f"Bearer {request.api_key}",
                    "Content-Type": "application/json"
                }
                
                messages = []
                if request.system_prompt:
                    messages.append({"role": "system", "content": request.system_prompt})
                messages.append({"role": "user", "content": request.message})
                
                chat_payload = {
                    "model": request.model,
                    "messages": messages,
                    "max_tokens": request.max_tokens,
                    "temperature": request.temperature,
                    "stream": True
                }
                
                async with client.stream(
                    "POST",
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=chat_payload
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield f"data: {json.dumps({'error': error_text.decode()[:500]})}\n\n"
                        return
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data.strip() == "[DONE]":
                                yield "data: [DONE]\n\n"
                                break
                            try:
                                chunk = json.loads(data)
                                content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if content:
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                            except json.JSONDecodeError:
                                continue
                                
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )