# 5 条入境游脚本：逐镜头起始帧与 AI 视频提示词

## 统一生成设置

- 画幅：竖屏 `9:16`，建议 `1080×1920`。
- 单镜头：2–4 秒；风景镜头 24fps，人物 Vlog 可用 30fps。
- 风格：真实旅游 UGC 与轻电影感结合，避免过度磨皮和虚假景区。
- 人物连续性：同一脚本尽量固定同一名外国游客、同一名导游及相同服装。
- 字幕、价格、地图、Logo、CTA 一律后期制作，不让视频模型生成文字。
- 通用负面提示词：`cartoon, CGI look, oversaturated colors, distorted face, extra fingers, duplicate people, warped architecture, floating objects, unreadable text, watermark, logo, flicker, frame jitter, sudden costume change, unnatural walking, time-lapse crowds`

---

# 脚本 1：北京——我没想到北京是这样的

## 镜头 1｜0–2 秒｜长城反应钩子

**起始帧描述**：竖屏近景，一名 25–35 岁欧美游客站在慕田峪长城城墙边，身体背对镜头、头部刚开始回望；长城沿山脊延伸，清晨金色侧光，天空通透，人物占画面右下三分之一。

**找图关键词**：`外国游客 慕田峪长城 回头 清晨` / `international traveler Mutianyu Great Wall sunrise reaction`

**图生视频提示词**：`The traveler turns toward the camera with a genuine surprised smile, then the camera rapidly pulls backward and rises slightly to reveal the Great Wall winding across the mountains. Morning breeze moves the hair and jacket naturally. Energetic first-second reveal, realistic handheld-to-drone feeling, natural golden light, 2 seconds, vertical travel ad.`

## 镜头 2｜2–5 秒｜故宫红墙

**起始帧描述**：故宫红墙和金色琉璃瓦构成对称透视，一扇圆形门洞位于中央，游客刚从门洞左侧迈入，清晨无人或少人，阳光在红墙上形成柔和阴影。

**找图关键词**：`故宫 红墙 门洞 清晨 游客` / `Forbidden City red wall round gate morning traveler`

**图生视频提示词**：`The traveler walks calmly through the circular doorway while the camera performs a slow lateral slide from left to right, revealing layered red walls and golden roofs. Clothing moves subtly in the breeze, restrained cinematic motion, quiet imperial atmosphere, photorealistic, 3 seconds.`

## 镜头 3｜5–8 秒｜胡同早餐 POV

**起始帧描述**：第一人称骑自行车进入北京老胡同，车把在画面底部，右侧是冒热气的早餐摊，能看到包子、豆浆和当地居民，灰砖院墙与树影自然生活化。

**找图关键词**：`北京胡同 骑自行车 早餐摊 POV` / `Beijing hutong bicycle POV breakfast stall`

**图生视频提示词**：`First-person bicycle movement glides slowly through a Beijing hutong toward a steaming breakfast stall. A vendor lifts a bamboo steamer and warm steam drifts into the lens; local residents move naturally in the background. Gentle handheld vibration, authentic morning life, 3 seconds.`

## 镜头 4｜8–12 秒｜交通与支付

**起始帧描述**：现代北京地铁入口，外国游客手持手机靠近闸机二维码扫描区，屏幕内容不必清晰；背景有英文方向标识和正在进站的列车，空间明亮干净。

**找图关键词**：`北京地铁 外国游客 手机扫码 闸机` / `foreigner Beijing subway mobile payment gate`

**图生视频提示词**：`The traveler taps the phone at the metro gate, the gate opens smoothly, and the camera follows over the shoulder as the traveler walks toward an arriving train. Clean modern station, natural commuter movement, confident and effortless travel mood, realistic motion, 4 seconds.`

## 镜头 5｜12–16 秒｜北京烤鸭反应

**起始帧描述**：餐桌近景，厨师或服务员刚把片好的北京烤鸭端到桌上，金黄酥脆鸭皮清晰；外国游客坐在对面，筷子刚夹起一卷鸭饼，期待地看向食物。

**找图关键词**：`外国游客 北京烤鸭 品尝 惊喜` / `international tourist tasting Peking duck reaction`

**图生视频提示词**：`The traveler takes the first bite of Peking duck, pauses, then gives an authentic delighted reaction and looks at a companion. Steam rises from the food, shallow depth of field shifts from crispy duck to the traveler’s face, warm restaurant light, appetizing realism, 4 seconds.`

## 镜头 6｜16–21 秒｜导游服务与日落

**起始帧描述**：长城日落时分，年轻中国导游拿手机为两名外国游客拍照；游客背对导游站在城墙边，远山与长城被暖色夕阳照亮。

**找图关键词**：`长城 日落 导游 给外国游客拍照` / `tour guide photographing foreign tourists Great Wall sunset`

**图生视频提示词**：`The guide adjusts the phone and takes a photo as the two travelers laugh and change pose. The camera arcs gently around the group, revealing the glowing sunset and distant Great Wall. Warm human interaction, premium small-group tour feeling, natural gestures, 5 seconds.`

## 镜头 7｜21–25 秒｜北京路线 CTA

**起始帧描述**：干净的旅行桌面俯拍，中央放北京纸质地图，四张拍立得分别是长城、故宫、胡同、烤鸭；一只手准备将最后一张照片放下，右侧留白供后期放 CTA。

**找图关键词**：`北京旅行地图 拍立得 俯拍 行程` / `Beijing itinerary map polaroid flat lay`

**图生视频提示词**：`A hand places the final Great Wall photo onto the Beijing map, then a red route line animates smoothly between four photo locations. The camera makes a subtle top-down push-in. Keep the right side clean and empty for later CTA typography, no generated text, 4 seconds.`

---

# 脚本 2：上海——72 小时未来城市挑战

## 镜头 1｜0–2 秒｜老上海到未来上海

**起始帧描述**：武康路附近老洋房街景，梧桐树形成拱形，外国情侣在前景过马路；画面中央有适合做遮挡转场的公交车或树干。

**找图关键词**：`上海武康路 老洋房 外国游客 梧桐` / `Shanghai Wukang Road international couple plane trees`

**图生视频提示词**：`The international couple crosses a quiet historic Shanghai street. A bus passes close across the full frame as a natural wipe; behind the wipe, reveal the same couple facing the futuristic Lujiazui skyline at blue hour. Perfect location match cut, smooth transition, realistic scale, 2 seconds.`

## 镜头 2｜2–5 秒｜外滩第一视角

**起始帧描述**：从外国游客肩后拍摄，人物走向外滩栏杆，东方明珠和陆家嘴天际线位于江对岸，傍晚蓝调，游客的手即将指向景色。

**找图关键词**：`外滩 外国游客 背影 东方明珠 蓝调` / `foreigner Bund Shanghai skyline over shoulder`

**图生视频提示词**：`Over-the-shoulder camera follows the traveler taking two steps toward the Bund railing. The traveler points toward the Oriental Pearl Tower as city lights gradually switch on. Gentle forward movement, natural river traffic, vivid but realistic blue-hour color, 3 seconds.`

## 镜头 3｜5–8 秒｜未来与便利

**起始帧描述**：上海高铁站或磁悬浮车厢内部，外国游客坐在窗边看手机，窗外城市产生轻微动感；画面整洁、科技感强，但不显示可读品牌或支付界面。

**找图关键词**：`上海磁悬浮 外国游客 车窗 手机` / `Shanghai maglev international traveler smartphone`

**图生视频提示词**：`The train accelerates smoothly while the city slides past the window. The traveler checks the phone, looks outside and smiles with relief. Add a brief focus shift from phone to fast-moving skyline, stable modern travel atmosphere, realistic reflections, 3 seconds.`

## 镜头 4｜8–12 秒｜梧桐街区慢生活

**起始帧描述**：上海梧桐街区露天咖啡座，外国情侣坐在小圆桌旁，一杯咖啡刚端上来；背景是老洋房、自行车和斑驳树影。

**找图关键词**：`上海梧桐区 咖啡馆 外国情侣 街拍` / `Shanghai French Concession cafe international couple`

**图生视频提示词**：`A server places coffee on the table; the couple exchanges a relaxed smile while bicycles pass softly in the background. Slow handheld push-in, leaves create moving dappled sunlight, sophisticated but authentic neighborhood mood, 4 seconds.`

## 镜头 5｜12–16 秒｜小笼包

**起始帧描述**：竹蒸笼刚打开，小笼包近距离占据前景，蒸汽升起；外国游客在背景拿筷子准备夹起一个，脸部保持可见。

**找图关键词**：`小笼包 蒸笼 外国游客 上海 美食` / `xiaolongbao steam foreign traveler Shanghai`

**图生视频提示词**：`The bamboo lid lifts and a wave of steam reveals fresh xiaolongbao. Focus racks to the traveler carefully lifting one with chopsticks, taking a small bite and reacting happily. Macro food detail, natural restaurant ambience, 4 seconds.`

## 镜头 6｜16–19 秒｜黄浦江夜游

**起始帧描述**：夜游船甲板，外国游客靠在栏杆上看陆家嘴灯光，江面反射霓虹；人物为半身背影，脸部轮廓略侧向镜头。

**找图关键词**：`黄浦江夜游 外国游客 陆家嘴` / `Huangpu River cruise international tourist Shanghai night`

**图生视频提示词**：`The boat moves along the Huangpu River as illuminated towers drift across the background. The traveler turns slightly toward the camera, then looks back at the skyline. Slow cinematic orbit, realistic wind and reflections, premium night-tour feeling, 3 seconds.`

## 镜头 7｜19–22 秒｜72 小时路线 CTA

**起始帧描述**：上海地图与手机俯拍构图，三张照片代表外滩、梧桐区和小笼包；左侧有行李牌和交通卡造型道具，中央和下方留出字幕区。

**找图关键词**：`上海72小时 行程地图 俯拍` / `Shanghai 72 hour itinerary map flat lay`

**图生视频提示词**：`Three destination photos slide one by one onto a Shanghai map while a clean route line connects them. A hand circles the final location with a marker. Subtle top-down zoom, reserved empty lower area for CTA added in post, no generated words, 3 seconds.`

---

# 脚本 3：西安——年轻英文导游的一天

## 镜头 1｜0–2 秒｜导游自拍开场

**起始帧描述**：年轻中国女导游在旅游车门旁举手机自拍，表情友好、自信；身后两三名外国游客正准备下车，导游穿简洁休闲装并佩戴小型导游证。

**找图关键词**：`西安 年轻女导游 外国游客 旅游车 vlog` / `young female tour guide Xi'an international tourists vlog`

**图生视频提示词**：`The young guide raises the phone for a casual selfie introduction and gestures for the guests to follow. Travelers step off the minibus behind her and wave naturally. Authentic smartphone vlog, subtle handheld shake, direct eye contact, energetic opening, 2 seconds.`

## 镜头 2｜2–6 秒｜兵马俑震撼揭示

**起始帧描述**：兵马俑单个武士面部超近景，陶土纹理和历史痕迹清晰；背景虚化，看不见完整俑坑，为拉远揭示保留空间。

**找图关键词**：`兵马俑 面部 特写 陶土纹理` / `Terracotta Warrior face extreme close-up`

**图生视频提示词**：`Begin on an extreme close-up of one Terracotta Warrior’s face, then rapidly pull backward and rise to reveal thousands of warriors arranged inside the vast excavation hall. Maintain exact historical architecture and statue geometry, dramatic scale reveal, smooth motion, 4 seconds.`

## 镜头 3｜6–10 秒｜讲解细节

**起始帧描述**：年轻导游站在参观护栏旁，指向远处不同造型的兵马俑；两名外国游客靠近认真观看，表情好奇，取中近景。

**找图关键词**：`兵马俑 英文导游 外国游客 讲解` / `English guide explaining Terracotta Warriors tourists`

**图生视频提示词**：`The guide points out a small detail on a warrior and explains enthusiastically. The two guests lean closer, exchange surprised looks and nod. Camera slowly moves from the guide’s hand to the guests’ reactions, documentary realism, 4 seconds.`

## 镜头 4｜10–14 秒｜西安城墙骑行

**起始帧描述**：两名外国游客骑自行车沿西安城墙前进，古城楼位于远处中央，年轻导游骑在侧前方回头示意；晴朗下午，宽阔路面形成引导线。

**找图关键词**：`西安城墙 骑自行车 外国游客 导游` / `international tourists cycling Xi'an City Wall`

**图生视频提示词**：`The cyclists move forward together along Xi'an City Wall. The guide looks back and signals playfully while the camera tracks parallel at bicycle speed. Clothing and hair respond to the wind, stable side-tracking movement, joyful group energy, 4 seconds.`

## 镜头 5｜14–19 秒｜夜市食物连击

**起始帧描述**：回民街夜市摊位，肉夹馍被从中间掰开，肉汁和热气清晰；背景灯笼与人群散景，外国游客伸手接过食物。

**找图关键词**：`西安回民街 肉夹馍 外国游客 夜市` / `Xi'an Muslim Quarter food international tourist roujiamo`

**图生视频提示词**：`A vendor hands a freshly made roujiamo to the traveler; steam rises as it is pulled apart. Use two fast whip-pan transitions to close-ups of hand-pulled noodles and grilled skewers, ending on the traveler’s delighted reaction. Energetic food montage, realistic night market, 5 seconds.`

## 镜头 6｜19–23 秒｜游客与导游建立信任

**起始帧描述**：西安餐馆内，导游与三名外国游客围坐圆桌，大家举杯准备碰杯；桌上是当地菜，人物自然大笑，暖色照明。

**找图关键词**：`西安 导游 外国游客 聚餐 碰杯` / `Xi'an guide international tourists dinner cheers`

**图生视频提示词**：`The group brings their glasses together in one natural toast, laughs, then turns briefly toward the camera. Slow handheld push-in, genuine friendship rather than posed advertising, warm restaurant light, clear faces, 4 seconds.`

## 镜头 7｜23–28 秒｜城墙夜景 CTA

**起始帧描述**：年轻导游面对镜头站在亮灯的西安城墙前，中景构图，背景灯光虚化；导游略偏左站立，右侧留出后期 CTA 字幕位置。

**找图关键词**：`西安城墙 夜景 女导游 对镜头` / `female tour guide Xi'an City Wall night portrait`

**图生视频提示词**：`The guide speaks directly to camera with a warm confident smile, gestures toward the illuminated city wall, then extends one hand in a welcoming invitation. Very gentle camera push-in, stable facial identity and lip movement, clean empty space on the right for post-production CTA, 5 seconds.`

---

# 脚本 4：云南——这真的是中国？

## 镜头 1｜0–2 秒｜蓝月谷误判钩子

**起始帧描述**：玉龙雪山与蓝月谷的超广角竖屏画面，碧蓝湖水在前景，一名外国游客背对镜头站在湖边作为比例参照，雪山占据上半部。

**找图关键词**：`蓝月谷 玉龙雪山 外国游客 竖屏` / `Blue Moon Valley Jade Dragon Snow Mountain traveler vertical`

**图生视频提示词**：`Start close behind the traveler, then rise and pull back quickly to reveal turquoise Blue Moon Valley and the full snow-covered Jade Dragon Snow Mountain. The traveler lifts both arms in amazement, crisp alpine morning, natural water movement, epic but photorealistic, 2 seconds.`

## 镜头 2｜2–4 秒｜地图落点

**起始帧描述**：简洁的东亚实体地图俯拍，中国轮廓清晰但没有文字，一枚红色旅行图钉悬在云南位置上方；桌面有登机牌与相机边角。

**找图关键词**：`中国地图 云南 图钉 旅行 俯拍` / `China map Yunnan travel pin flat lay`

**图生视频提示词**：`A red travel pin drops onto southwest China with a soft bounce, then a thin route line draws toward the location. Camera performs a quick controlled push-in. Keep all map labels blank and add the word Yunnan later in editing, 2 seconds.`

## 镜头 3｜4–8 秒｜洱海骑行

**起始帧描述**：外国游客骑复古自行车沿洱海边公路前进，湖面和苍山在左侧，人物衣摆被微风吹起；低机位侧后方拍摄，阳光清澈。

**找图关键词**：`大理洱海 骑行 外国游客 苍山` / `international traveler cycling Erhai Lake Dali`

**图生视频提示词**：`The traveler cycles smoothly beside Erhai Lake as the camera tracks from a low rear-side angle. The traveler briefly looks toward the lake, sunlight sparkles on the water and clothing moves naturally in the breeze. Peaceful premium slow-travel mood, 4 seconds.`

## 镜头 4｜8–12 秒｜丽江古城清晨

**起始帧描述**：丽江古城清晨湿润石板路，流水小桥和木质老屋，两盏灯笼作为前景；外国游客独自从远处向镜头走来，街道安静。

**找图关键词**：`丽江古城 清晨 石板路 外国游客` / `Lijiang Old Town early morning international traveler`

**图生视频提示词**：`The traveler walks slowly along the stone lane while the camera glides backward at matching speed. Water flows beside the path, a shopkeeper opens a wooden door, and soft morning mist lifts gradually. Quiet authentic old-town atmosphere, no crowds, 4 seconds.`

## 镜头 5｜12–16 秒｜香格里拉草原

**起始帧描述**：香格里拉高原草甸，牦牛在前景低头吃草，远处雪山和藏式房屋；外国游客穿户外夹克站在中景侧身看山。

**找图关键词**：`香格里拉 草原 牦牛 雪山 外国游客` / `Shangri-La Yunnan yak grassland traveler snow mountain`

**图生视频提示词**：`A yak walks slowly across the foreground while the traveler turns toward the distant snow mountains. The camera makes a wide gentle arc, revealing Tibetan-style houses and layered grassland. Natural wind moves the grass, expansive calm feeling, 4 seconds.`

## 镜头 6｜16–20 秒｜当地家宴

**起始帧描述**：云南当地家庭木桌家宴，少数民族主人与两名外国游客围坐，主人正把一道菜递向游客；室内暖光，有真实生活细节，不做舞台化表演。

**找图关键词**：`云南 少数民族 家宴 外国游客 真实` / `Yunnan local family dinner international travelers authentic`

**图生视频提示词**：`The host places a homemade dish at the center of the table and invites the travelers to taste it. One traveler tries the food and smiles gratefully; everyone laughs naturally. Intimate handheld camera, warm practical lighting, respectful documentary tone, 4 seconds.`

## 镜头 7｜20–24 秒｜云南路线 CTA

**起始帧描述**：云南轮廓地图俯拍，四张照片分别为丽江、大理、香格里拉、玉龙雪山；小型越野车模型位于路线起点，下方和右侧留白。

**找图关键词**：`云南旅游路线 地图 照片 俯拍` / `Yunnan travel itinerary map photo flat lay`

**图生视频提示词**：`A miniature travel vehicle moves along a clean route connecting four destination photos on the Yunnan map. Photos lift slightly as each stop is reached. Slow top-down push-in, keep the lower-right area empty for CTA and price added in post, no text, 4 seconds.`

---

# 脚本 5：四城线路——第一次来中国怎么选

## 镜头 1｜0–2 秒｜四宫格选择题

**起始帧描述**：规整四宫格竖屏拼图：左上长城、右上上海夜景、左下兵马俑、右下云南雪山；四格色彩协调，每格都有一名同样穿着的外国游客作为连续人物。

**找图关键词**：`长城 上海夜景 兵马俑 云南雪山 拼图 外国游客` / `China four destination split screen traveler`

**图生视频提示词**：`Four synchronized panels come alive at once: traveler turns on the Great Wall, Shanghai lights switch on, camera pulls back from a Terracotta Warrior, and clouds move across a Yunnan snow mountain. Keep borders perfectly stable and each panel realistic, high-energy comparison hook, 2 seconds.`

## 镜头 2｜2–6 秒｜北京选项

**起始帧描述**：外国游客站在故宫高处或开阔广场，远景为红墙金瓦，手里拿着北京路线小卡；画面左侧可快速插入长城和烤鸭特写。

**找图关键词**：`北京故宫 外国游客 旅行广告` / `Beijing Forbidden City international traveler commercial`

**图生视频提示词**：`The traveler turns to reveal the Forbidden City behind them. Use two clean whip-pan transitions: first to walking on the Great Wall, then to crispy Peking duck being served. Return to the traveler smiling in Beijing, energetic but readable montage, 4 seconds.`

## 镜头 3｜6–10 秒｜上海选项

**起始帧描述**：外滩蓝调时刻，外国游客侧身站在栏杆旁，浦东天际线清晰；游客手中拿一杯咖啡，城市与生活方式兼具。

**找图关键词**：`上海外滩 蓝调 外国游客 咖啡` / `Shanghai Bund blue hour international traveler`

**图生视频提示词**：`The traveler walks along the Bund as the camera tracks beside them. Match cut to a leafy historic street and then to steaming xiaolongbao, ending with the futuristic skyline. Stylish urban rhythm, realistic city movement, 4 seconds.`

## 镜头 4｜10–14 秒｜西安选项

**起始帧描述**：兵马俑大厅中景，外国游客和年轻导游站在参观护栏旁，导游正指向俑坑；画面具有宏大纵深。

**找图关键词**：`兵马俑 外国游客 导游 宏大` / `Terracotta Warriors foreign visitor tour guide wide`

**图生视频提示词**：`Camera pushes past the guide’s pointing hand toward the Terracotta Warriors, then transitions to travelers cycling on Xi'an City Wall and tasting night-market food. Strong historical adventure rhythm, authentic reactions, clean transitions, 4 seconds.`

## 镜头 5｜14–18 秒｜云南选项

**起始帧描述**：洱海岸边木栈道，外国游客面向湖泊与苍山，旁边停着自行车；天空有少量移动云层，整体清新安静。

**找图关键词**：`洱海 苍山 外国游客 木栈道 自行车` / `Erhai Lake Cangshan international traveler boardwalk bicycle`

**图生视频提示词**：`The traveler steps toward the lake, then the camera sweeps upward into a seamless transition to Jade Dragon Snow Mountain and a quiet Lijiang stone lane. Slow-travel pace, clean alpine color, gentle natural movement, 4 seconds.`

## 镜头 6｜18–23 秒｜一站式服务

**起始帧描述**：中国高铁车厢窗边，外国情侣坐在一起查看行程，年轻中国导游站在过道旁指向手机；窗外景色虚化，桌上有车票套和行李牌但无可读文字。

**找图关键词**：`中国高铁 外国游客 导游 行程` / `China high speed train international tourists guide itinerary`

**图生视频提示词**：`The guide points to the itinerary on the phone, the couple nods, and the camera transitions through the train window to a hotel welcome and a pre-arranged vehicle pickup. Smooth connected journey, reassuring service tone, realistic interactions, 5 seconds.`

## 镜头 7｜23–27 秒｜游客选择城市

**起始帧描述**：四名不同国籍的年轻游客站在明亮简洁的旅行集合点，依次面对镜头；每个人手持一张只有代表性照片、没有文字的城市卡片。

**找图关键词**：`多国游客 中国旅行 城市选择 卡片` / `diverse international travelers choosing China destinations`

**图生视频提示词**：`Four travelers step toward the camera one after another and confidently present their destination photo card: Great Wall, Shanghai skyline, Terracotta Warriors, Yunnan snow mountain. Each person gives a natural excited reaction. Quick rhythmic cuts, stable faces and cards, 4 seconds.`

## 镜头 8｜27–30 秒｜最终 CTA

**起始帧描述**：桌面俯拍，中国地图居中，北京、上海、西安、云南分别用四种彩色图钉标记，四张目的地照片围绕地图；中央下方保留大块干净区域。

**找图关键词**：`中国旅行地图 北京上海西安云南 路线 俯拍` / `China itinerary map Beijing Shanghai Xi'an Yunnan flat lay`

**图生视频提示词**：`Four colored route lines draw from the edge of the map toward Beijing, Shanghai, Xi'an and Yunnan. The four destination photos slide neatly into place, followed by a gentle final camera push-in. Leave a clean central-lower area for the comment CTA added in editing, no generated text, 3 seconds.`

---

# 素材选择检查表

找起始帧时优先选择：

1. 原图至少 1080 像素高，主体清晰，尽量没有水印和现成字幕。
2. 人物手脚完整、脸部无遮挡；需要说话的镜头使用正面或轻微侧面。
3. 画面四周留有运动空间：拉远镜头需要更大的环境图，人物行走镜头前方要留空。
4. 同一条片中的主人公保持年龄、发型、肤色、衣服颜色一致。
5. 地标建筑必须真实准确；AI 生成后检查长城垛口、故宫屋顶、兵马俑、东方明珠等结构。
6. 商用前确认照片、人物肖像、音乐及生成模型输出具有广告使用权限。
