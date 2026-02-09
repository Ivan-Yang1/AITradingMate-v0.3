"""通知服务 - 支持浏览器推送和邮件通知"""
import logging
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class NotificationService:
    """通知服务"""
    
    def __init__(self):
        # 邮件配置（从环境变量获取）
        self.smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        self.smtp_user = os.environ.get("SMTP_USER", "")
        self.smtp_password = os.environ.get("SMTP_PASSWORD", "")
        self.from_email = os.environ.get("FROM_EMAIL", self.smtp_user)
        
        # 存储用户通知设置
        self.user_notification_settings: Dict[str, Dict[str, Any]] = {}
        
        # 通知历史
        self.notification_history: List[Dict[str, Any]] = []
        
        logger.info("NotificationService initialized")
    
    def get_user_settings(self, user_id: str) -> Dict[str, Any]:
        """获取用户通知设置"""
        if user_id not in self.user_notification_settings:
            self.user_notification_settings[user_id] = {
                "browser_enabled": True,
                "email_enabled": False,
                "email_address": "",
                "quiet_hours_start": None,  # 免打扰开始时间
                "quiet_hours_end": None,    # 免打扰结束时间
                "notification_types": {
                    "golden_cross": True,
                    "death_cross": True,
                    "rsi_oversold": True,
                    "rsi_overbought": True,
                    "macd_golden_cross": True,
                    "macd_death_cross": True,
                    "price_breakout": True,
                    "volume_breakout": True,
                    "boll_lower": True,
                    "boll_upper": True,
                },
            }
        return self.user_notification_settings[user_id]
    
    def update_user_settings(self, user_id: str, settings: Dict[str, Any]) -> Dict[str, Any]:
        """更新用户通知设置"""
        current = self.get_user_settings(user_id)
        current.update(settings)
        self.user_notification_settings[user_id] = current
        logger.info(f"Updated notification settings for user {user_id}")
        return current
    
    def is_in_quiet_hours(self, user_id: str) -> bool:
        """检查是否在免打扰时间内"""
        settings = self.get_user_settings(user_id)
        start = settings.get("quiet_hours_start")
        end = settings.get("quiet_hours_end")
        
        if not start or not end:
            return False
        
        now = datetime.now().time()
        start_time = datetime.strptime(start, "%H:%M").time()
        end_time = datetime.strptime(end, "%H:%M").time()
        
        if start_time <= end_time:
            return start_time <= now <= end_time
        else:
            # 跨午夜的情况
            return now >= start_time or now <= end_time
    
    def send_browser_notification(self, user_id: str, title: str, body: str, 
                                   data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        准备浏览器通知数据（实际推送由前端处理）
        返回通知数据供前端使用
        """
        settings = self.get_user_settings(user_id)
        
        if not settings.get("browser_enabled", True):
            return {"success": False, "reason": "browser_disabled"}
        
        if self.is_in_quiet_hours(user_id):
            return {"success": False, "reason": "quiet_hours"}
        
        notification = {
            "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "type": "browser",
            "title": title,
            "body": body,
            "data": data or {},
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
        }
        
        # 记录通知历史
        self.notification_history.append(notification)
        
        return {
            "success": True,
            "notification": notification,
        }
    
    def send_email_notification(self, user_id: str, subject: str, body: str,
                                 html_body: Optional[str] = None) -> Dict[str, Any]:
        """发送邮件通知"""
        settings = self.get_user_settings(user_id)
        
        if not settings.get("email_enabled", False):
            return {"success": False, "reason": "email_disabled"}
        
        email_address = settings.get("email_address", "")
        if not email_address:
            return {"success": False, "reason": "no_email_address"}
        
        if self.is_in_quiet_hours(user_id):
            return {"success": False, "reason": "quiet_hours"}
        
        # 检查SMTP配置
        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP not configured, email notification skipped")
            return {"success": False, "reason": "smtp_not_configured"}
        
        try:
            # 创建邮件
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = email_address
            
            # 添加纯文本内容
            part1 = MIMEText(body, "plain", "utf-8")
            msg.attach(part1)
            
            # 添加HTML内容（如果有）
            if html_body:
                part2 = MIMEText(html_body, "html", "utf-8")
                msg.attach(part2)
            
            # 发送邮件
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, email_address, msg.as_string())
            
            # 记录通知历史
            notification = {
                "id": f"email_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "type": "email",
                "subject": subject,
                "body": body,
                "to": email_address,
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
            }
            self.notification_history.append(notification)
            
            logger.info(f"Email sent to {email_address}")
            return {"success": True, "message": "Email sent successfully"}
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return {"success": False, "reason": str(e)}
    
    def send_monitor_alert(self, user_id: str, monitor_data: Dict[str, Any], 
                           alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """发送监控告警通知"""
        stock_name = monitor_data.get("stock_name", "未知股票")
        stock_code = monitor_data.get("stock_code", "")
        latest_price = monitor_data.get("latest_price", 0)
        
        # 构建通知内容
        alert_messages = [alert.get("message", "") for alert in alerts]
        
        # 浏览器通知
        browser_title = f"🔔 {stock_name}({stock_code}) 监控触发"
        browser_body = "\n".join(alert_messages[:3])  # 最多显示3条
        if len(alert_messages) > 3:
            browser_body += f"\n...还有{len(alert_messages) - 3}条告警"
        
        browser_result = self.send_browser_notification(
            user_id=user_id,
            title=browser_title,
            body=browser_body,
            data={
                "stock_code": stock_code,
                "stock_name": stock_name,
                "alerts": alerts,
                "latest_price": latest_price,
            }
        )
        
        # 邮件通知
        email_subject = f"【股票监控】{stock_name}({stock_code}) 触发告警"
        email_body = f"""
您设置的股票监控已触发！

股票：{stock_name}({stock_code})
最新价：{latest_price:.2f}
触发时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

告警详情：
{chr(10).join(['• ' + msg for msg in alert_messages])}

---
此邮件由AI金融助手自动发送，请勿回复。
"""
        
        email_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #00d4aa, #00b894); padding: 20px; text-align: center; }}
        .header h1 {{ color: #000; margin: 0; font-size: 18px; }}
        .content {{ padding: 24px; color: #e0e0e0; }}
        .stock-info {{ background: #2d2d3a; border-radius: 8px; padding: 16px; margin-bottom: 16px; }}
        .stock-name {{ font-size: 20px; font-weight: bold; color: #fff; }}
        .stock-code {{ color: #888; font-size: 14px; }}
        .price {{ font-size: 24px; font-weight: bold; color: #00d4aa; margin-top: 8px; }}
        .alerts {{ margin-top: 16px; }}
        .alert-item {{ background: #3d3d4a; border-radius: 6px; padding: 12px; margin-bottom: 8px; border-left: 3px solid #00d4aa; }}
        .footer {{ padding: 16px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #2d2d3a; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 股票监控告警</h1>
        </div>
        <div class="content">
            <div class="stock-info">
                <div class="stock-name">{stock_name}</div>
                <div class="stock-code">{stock_code}</div>
                <div class="price">¥{latest_price:.2f}</div>
            </div>
            <div class="alerts">
                <h3 style="color: #fff; margin-bottom: 12px;">告警详情</h3>
                {''.join([f'<div class="alert-item">{msg}</div>' for msg in alert_messages])}
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 16px;">
                触发时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            </p>
        </div>
        <div class="footer">
            此邮件由AI金融助手自动发送，请勿回复
        </div>
    </div>
</body>
</html>
"""
        
        email_result = self.send_email_notification(
            user_id=user_id,
            subject=email_subject,
            body=email_body,
            html_body=email_html
        )
        
        return {
            "browser": browser_result,
            "email": email_result,
        }
    
    def get_notification_history(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """获取用户的通知历史"""
        user_notifications = [
            n for n in self.notification_history 
            if n.get("user_id") == user_id
        ]
        return sorted(user_notifications, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
    
    def clear_notification_history(self, user_id: str) -> bool:
        """清除用户的通知历史"""
        self.notification_history = [
            n for n in self.notification_history 
            if n.get("user_id") != user_id
        ]
        return True


# 创建服务实例
notification_service = NotificationService()