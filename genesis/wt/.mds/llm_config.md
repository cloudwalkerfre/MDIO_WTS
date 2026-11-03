# PROVIDERS

## deepseek
- base_url: https://api.deepseek.com
- api_key: env:DEEPSEEK_API_KEY
- timeout: 180

# LLM_CONFIG

## DEFAULT
- provider: deepseek
- model: deepseek-flash
- reasoning_effort: max
- extra_body: {"thinking": {"type": "enabled"}}

## DEEPSEEK_V4F
- provider: deepseek
- model: deepseek-flash
- reasoning_effort: auto
