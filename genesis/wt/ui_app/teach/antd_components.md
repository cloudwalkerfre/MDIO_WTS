# ANTD

## COMPONENTS

### 左栏

#### 输入行
- INPUT1:
    - value: 1
    - placeholder: hi@example.com
    - width: 141
- SELECT1:
    - mode: tags
    - chosen: Apple, Banana
    - options: Apple, Banana, Orange
    - width: 300

#### 颜色与日期行
- COLOR1:
    - value: #1a1770
    - width: 100
- SELECT2:
    - chosen: Menu
    - options: Dropdown, Menu, Input
    - width: 130
- DATE1:
    - value: 2026-10-13
    - placeholder: Select Date
    - width: 195

#### 选择行
- CHECK1:
    - chosen: apple
    - options: apple:Apple, pear:Pear
- RADIO1:
    - chosen: pear
    - options: apple:Apple, pear:Pear
- SWITCH1:
    - value: off
- PROGRESS1:
    - value: 75
    - type: circle
    - size: 20

#### 步骤行
- STEPS1:
    - current: 1
    - options: Finished, In Process@error, Waiting

#### 进度行
- PROGRESS2:
    - value: 50
- PROGRESS3:
    - value: 66
    - status: exception

#### 徽标行
- BADGE1:
    - status: success
    - text: Success
- BADGE2:
    - status: error
    - text: Error
- BADGE3:
    - status: default
    - text: Default
- BADGE4:
    - status: processing
    - text: Processing
- BADGE5:
    - status: warning
    - text: Warning

#### 二维码行
- QRCODE1:
    - value: https://ant.design
    - size: 158
- SPIN1:
    - size: small
- RATE1:
    - value: 5
- TAG1:
    - color: blue
    - icon: TwitterOutlined
    - text: Twitter
- TAG2:
    - color: red
    - icon: YoutubeOutlined
    - text: Youtube
- TAG3:
    - color: blue
    - icon: FacebookOutlined
    - text: Facebook
- POP1:
    - value: closed
    - title: Are you OK?
    - ok: 确定
    - cancel: 取消

#### 分段行
- SEGMENT1:
    - chosen: 1Y
    - options: 1D, 7D, 1M, 1Y, All
- SEGMENT2:
    - chosen: emails
    - options: chats:Chats@MessageOutlined, emails:Emails@MailOutlined

### 中栏

#### 验证卡
- AVATARS1:
    - imgs: https://avatars.githubusercontent.com/u/5836790?v=4, https://avatars.githubusercontent.com/u/10286961?v=4, https://avatars.githubusercontent.com/u/49217418?v=4, https://avatars.githubusercontent.com/u/1061968?v=4, https://avatars.githubusercontent.com/u/6802825?v=4, https://avatars.githubusercontent.com/u/10607168?v=4
    - more: +5
- TITLE1:
    - value: Verify account
- DESC1:
    - value: We've sent a code to a****@gmail.com
- OTP1:
    - value: 4,3,2,0,1,2
- RESEND1:
    - value: Didn't receive a code?
    - action: Resend

#### 按钮行
- BTN1:
    - text: Primary button
    - type: primary
    - pressed: off
- BTN2:
    - text: Danger button
    - danger: true
    - pressed: 
- BTN3:
    - text: Outlined button
    - shape: round
    - dashed: true
    - pressed: 
- BTN4:
    - text: Round button
    - shape: round
    - danger: true
    - pressed: 

#### 品牌卡
- BRAND1:
    - name: Ant Design
    - handle: '@ant-design'
    - desc: Building the future of UI for web & mobile.

#### 通知卡
- NOTICE1:
    - value: open
    - title: Ant Design
    - desc: An enterprise-class design system for building modern, intelligent, and delightful user experiences.

### 右栏

#### 创建账户
- CREATE1:
    - title: Create an account
    - desc: Start your free 7-day trial. No credit card required.
    - button: Get Started
    - pressed: 
- DIVIDER1:
    - value: OR
- OAUTH1:
    - google: Continue with Google
    - apple: Continue with Apple
    - pressed: 

#### 模态
- MODAL1:
    - value: open
    - title: Ant Design
    - desc: Ant Design use CSS-in-JS technology to provide dynamic & mix theme ability.
    - ok: 确定
    - cancel: 取消
