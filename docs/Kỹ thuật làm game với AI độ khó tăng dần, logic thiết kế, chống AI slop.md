# Kỹ thuật làm game với AI: độ khó tăng dần, logic thiết kế, chống AI slop

Oct 29, 2026 · @Quí

Báo cáo này tổng hợp các tài liệu về thiết kế độ khó, level design, sinh nội dung tự động và quy trình làm game cùng AI, để bạn dùng làm khung kiểm soát chất lượng cho AI làm game.

## Tóm tắt

Để AI làm game có logic và không ra rác, hãy ép nó đi theo một cấu trúc cố định (đường cong, thẻ level, kiểm chứng tự động) thay vì xin nó "làm game hay".

- **Độ khó bám kỹ năng đã dạy.** Giữ người chơi trong flow, dùng đường cong răng cưa, và tăng khó bằng cách ghép các cơ chế cũ.
- **Mỗi level một ý tưởng, đi theo 4 bước:** giới thiệu, phát triển, twist, kết.
- **Đo thay vì cảm nhận.** Bộ kiểm tra giải được, bot chơi thử và báo cáo độ khó theo level là thứ AI phải viết cùng game.
- **Slop đến từ prompt nông và game thiếu chiều sâu.** Thêm từng lớp chiều sâu, test sau mỗi lớp, playtest ngắn thường xuyên.
- **Giao AI việc hẹp, có test, có tài liệu ngắn.** Giữ trực giác thiết kế và cảm giác chơi ở con người.

**Giới hạn của bằng chứng.** Nhiều nguồn là blog hoặc quan điểm cá nhân. Các nghiên cứu playtest bằng agent mới thử trên một hoặc vài game. LLM sinh được level nhưng chưa điều khiển được độ khó chỉ bằng lời nhắc. Các phần "hàm ý cho AI" và bộ quy tắc ở trên là suy luận của tôi, không phải kết luận của nguồn.

## Độ khó tăng dần

Độ khó phải bám theo kỹ năng người chơi vừa học được, không bám theo số thứ tự level. Nền lý thuyết là flow: thử thách vượt kỹ năng thì người chơi lo lắng và bỏ đi, kỹ năng vượt thử thách thì họ chán và bỏ đi ([Game Developer](https://www.gamedeveloper.com/design/the-flow-applied-to-game-design)).

**Hai tầng flow.** Microflow là vòng lặp ngắn của một phiên chơi, dựng bằng nhịp thao tác và phản hồi tức thì. Macroflow là đường cong độ khó của cả game, gồm các bước dạy, tiến độ khó, động lực và sự đa dạng. Bài này cũng cảnh báo không nên hạ độ khó chỉ vì phản hồi playtest, vì có thể làm mất người chơi cần thử thách ([Game Developer](https://www.gamedeveloper.com/design/the-flow-applied-to-game-design)).

**Các kiểu đường cong**

| Kiểu | Hình dạng | Hợp với |
| --- | --- | --- |
| Tuyến tính | Tăng đều mỗi level | Game ngắn; game dài dễ đơn điệu |
| Lũy thừa | Chậm lúc đầu, nhanh về sau | Game arcade chơi lấy điểm, như Tetris |
| Bậc thang | Nhảy ở mốc cố định, có đoạn bằng để thuần thục | Game có boss hoặc mốc rõ, như Mega Man |
| Răng cưa | Khó và dễ xen kẽ, mỗi đỉnh cao hơn đỉnh trước | Game cần xả căng thẳng mà vẫn đi lên |
| Chữ U ngược | Đỉnh ở giữa game, dịu dần về cuối | Game muốn phần kết mang cảm giác mạnh mẽ |

Nguồn bảng: [Abratabia](https://www.abratabia.com/game-design/difficulty-curves.php). Bài [Stepico](https://stepico.com/blog/video-game-level-design-and-difficulty-how-to-challenge-players-without-losing-them/) cũng khuyên chọn răng cưa hơn bậc thang: dạy cơ chế ở chỗ ít rủi ro, nâng dần, thử ở đỉnh, rồi hạ nhịp trước cơ chế kế tiếp.

**Nguyên tắc rút ra**

- **Khớp với đường học.** Kỹ năng tăng nhanh lúc đầu, đi ngang khi củng cố, nhảy vọt khi đột phá, nên đường tuyến tính khiến đầu game quá khó và cuối game quá dễ. Một gợi ý: 20% đầu game phủ 30% đầu thang độ khó, 20% cuối phủ 40% cuối ([Abratabia](https://www.abratabia.com/game-design/difficulty-curves.php)). Đây là gợi ý của một tác giả, không phải quy luật.
- **Tăng khó bằng cách kết hợp.** Ghép các cơ chế đã biết thay vì thêm cơ chế mới; ba cơ chế A, B, C cho ra bảy loại thử thách (ba đơn, ba cặp, một bộ ba) ([Abratabia](https://www.abratabia.com/game-design/level-design-basics.php)).
- **Roguelike có hai đường cong.** Một đường trong mỗi lượt chơi, thường tăng kiểu lũy thừa, và một đường qua các lượt, tăng chậm dần khi nâng cấp vĩnh viễn ([Abratabia](https://www.abratabia.com/game-design/difficulty-curves.php)).
- **Độ khó là một bó hệ thống.** Hành vi kẻ địch, độ khan hiếm tài nguyên, cửa sổ thời gian và chi phí thất bại phải chỉnh cùng nhau. Mỗi đỉnh khó cần phần thưởng tương xứng, và thử thách phải đọc được (đòn đánh có báo hiệu) thì mới công bằng ([Stepico](https://stepico.com/blog/video-game-level-design-and-difficulty-how-to-challenge-players-without-losing-them/)).
- **Theo dõi cả sức mạnh nhân vật lẫn kỹ năng người chơi.** Chỉ scale một bên sẽ khiến một nhóm người chơi chán hoặc thấy bị chơi xấu ([Stepico](https://stepico.com/blog/video-game-level-design-and-difficulty-how-to-challenge-players-without-losing-them/)).
- **Đo bằng dữ liệu.** Retention tụt sau một level cụ thể cho thấy level đó có thể quá khó; tỉ lệ hoàn thành quá cao ở level muộn cho thấy game quá dễ. Loại trừ lỗi crash và quảng cáo phiền trước khi đổ lỗi cho độ khó ([PocketGamer.biz](https://www.pocketgamer.biz/difficulty-curves-find-the-right-balance-and-boost-retention-and-revenue)).
- **Playtest với người mới.** Nhà thiết kế đánh giá sai độ khó game của chính mình ([Stepico](https://stepico.com/blog/video-game-level-design-and-difficulty-how-to-challenge-players-without-losing-them/)).

**Hàm ý cho AI (suy luận của tôi từ các nguồn trên).** Bắt AI chọn một kiểu đường cong trước khi sinh level, gán mỗi level một điểm độ khó, và ghi rõ level đó dùng kỹ năng nào đã dạy. Tăng độ khó chỉ được phép bằng cách ghép kỹ năng cũ.

## Level design có logic

Mỗi level nên dạy hoặc thử đúng một ý tưởng, theo một trình tự cố định, để người chơi tự suy ra luật mà không cần chữ hướng dẫn. Đây là phần có giá trị nhất để ép AI thiết kế có logic.

**Cấu trúc 4 bước của Nintendo.** Koichi Hayashida dùng cấu trúc này khi thiết kế Super Mario 3D Land và 3D World, lấy cảm hứng từ bố cục truyện bốn khung (Kishōtenketsu) ([slide giới thiệu level design](https://www.slideshare.net/slideshow/introduction-to-level-design-49277472/49277472); video của Game Maker's Toolkit được tóm tắt tại [MCV](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps)).

1. **Giới thiệu:** đưa cơ chế vào chỗ an toàn để người chơi học khái niệm.
2. **Phát triển:** thử thách đầu tiên với cơ chế đó, thất bại thì phải thử lại.
3. **Twist:** một biến thể bất ngờ của cùng khái niệm.
4. **Kết:** một cơ hội cuối để người chơi thể hiện những gì đã học.

Ví dụ Super Mario Bros. màn 1-1: Goomba đầu tiên nằm đúng chỗ người chơi chắc chắn gặp và có khoảng rộng để phản ứng; các Goomba sau nằm ở chỗ hẹp hơn; một Goomba trên bục cao buộc cách tiếp cận mới; cuối cùng là đường thẳng tới cột cờ ([Abratabia](https://www.abratabia.com/game-design/level-design-basics.php)).

**Giới thiệu an toàn.** Theo [Abratabia](https://www.abratabia.com/game-design/level-design-basics.php):

- Đặt cơ chế mới vào nơi thất bại ít tốn kém, không hố sâu, không chết ngay.
- Bao quanh bằng địa hình người chơi đã hiểu, để thứ cần học chỉ có một.
- Mỗi lần chỉ thêm một yếu tố mới, vì thêm hai thì thất bại không cho biết lỗi do yếu tố nào.

**Vai trò theo giai đoạn.** Level đầu dạy cơ chế trong bối cảnh an toàn rồi thử nhẹ. Level giữa kết hợp các cơ chế đã học, thêm biến thể môi trường và nâng mức cược. Level cuối kiểm tra độ thuần thục bằng cách xếp toàn bộ bộ kỹ năng của người chơi vào các tình huống phức tạp ([Abratabia](https://www.abratabia.com/game-design/level-design-basics.php)).

**Portal dạy không cần hướng dẫn.** Một bài phân tích mô tả game chỉ có khoảng năm, sáu mẹo cốt lõi, rồi mọi câu đố đều là biến thể của chúng, nên độ khó tăng mà không cần luật mới. Vết cháy trên tường cho người chơi thấy cổng sẽ đáp ở đâu trước khi bắn, và các mảng tường mở rộng báo trước lối đi cho những tình huống tưởng như bất khả ([Designer Notes](https://www.designer-notes.com/portal/), quan điểm của người viết bài, không phải tài liệu của Valve). Game dài khoảng 3 đến 4 giờ nên kết thúc trước khi các cơ chế bị lặp.

**Hàm ý cho AI (suy luận của tôi).** Bắt AI viết một "thẻ level" trước khi dựng level, gồm: cơ chế được dạy, bước nào trong 4 bước, kỹ năng tiên quyết, điều kiện thắng và lý do level này khó hơn level trước. Level nào không điền được thẻ thì không được thêm vào game.

## Cân bằng và đo độ khó

Đừng để AI tự "cảm nhận" độ khó. Hãy cho nó quy tắc đặt tài nguyên, bộ kiểm tra tự động và một người chơi giả để chạy thử trước khi chấp nhận nội dung mới.

**Quy tắc leo thang theo độ sâu (roguelike).** [Abratabia](https://abratabia.com/procedural-generation/roguelike-levels.php) mô tả các quy tắc sau, không phải một công thức điểm số chính thức:

- Phân tầng kẻ địch theo độ sâu: tầng đầu là địch cơ bản, tầng giữa thêm địch tầm xa và gây hiệu ứng, tầng sâu thêm địch triệu hồi quân.
- Dịch dần bảng độ hiếm vật phẩm, và leo thang bẫy từ bẫy nhìn thấy được đến bẫy ẩn, di chuyển, hẹn giờ.
- Rải tài nguyên thiết yếu (máu, đạn, đường thoát) đều đặn dọc đường chính, đặt cửa hàng và điểm hồi máu theo nhịp người chơi dự đoán được.

**Công bằng và luôn giải được.** Cũng theo bài trên: generator không bao giờ được tạo tình huống chết không tránh khỏi dù người chơi giỏi đến đâu, phải luôn có đường tới lối ra, mọi cửa khóa phải có chìa với tới được, và luật sinh phải nhất quán để người chơi học được qua các lượt.

**Bốn lớp kiểm chứng tự động** ([Abratabia](https://abratabia.com/procedural-generation/roguelike-levels.php)):

1. Kiểm tra cấu trúc: nối tới lối ra, chìa trước khóa, nằm trong biên.
2. Mô phỏng bằng AI chơi đơn giản qua hàng nghìn lượt, đo tỉ lệ hoàn thành, máu lúc ra, vật phẩm thu được, thời gian.
3. Phân tích phân bố độ khó: máu trung bình theo độ sâu phải giảm đều qua nhiều seed, không có gai bất thường.
4. Hồi quy theo seed: giữ một thư viện seed tham chiếu (khó, dễ, trường hợp biên) và chạy lại sau mỗi lần sửa generator.

**Playtest bằng agent: đã có gì**

| Nghiên cứu | Cách làm | Kết quả và giới hạn |
| --- | --- | --- |
| [Roohi và cộng sự, CHI PLAY 2021](https://arxiv.org/pdf/2107.12061) | Agent chơi mỗi level nhiều lần; thống kê lượt chơi tốt nhất dự đoán tỉ lệ qua màn của người thật | Thử trên Angry Birds Dream Blast, 168 level, 95.266 người chơi; dự đoán churn chỉ cải thiện nhẹ; mới kiểm chứng trên một game |
| [Assessing Video Game Balance using Autonomous Agents](https://arxiv.org/pdf/2304.08699) | Agent học tăng cường (PPO, A2C) cùng agent ngẫu nhiên trên hai game platformer | Phát hiện gai độ khó và nơi may rủi lấn át kỹ năng; thiết kế reward tốn công, không thay được test thủ công |
| [Dungeons & Replicants II](https://antoniosliapis.com/papers/dungeons_replicants_automated_game_balancing_across_multiple_difficulty_dimensions_via_deep_player_behavior_modeling.pdf) | Mô hình hóa hành vi của 213 người chơi Aion thành "replicant", rồi chỉnh thông số kẻ địch về mức proficiency mục tiêu | Xóa chênh lệch giữa các lớp nhân vật; chỉ mới thử với giao tranh 1 đấu 1 trong một game |
| [Luden.io](https://blog.luden.io/ai-agents-in-game-development-real-production-lessons-failed-experiments-and-workshop-101-7d71e64685fa) | Agent tự chơi thử toàn bộ game | Chụp màn hình quá chậm; agent dùng văn bản bấm nhầm vật thể ẩn; lớp input giả kèm kịch bản tốt hơn nhưng chỉ khi game ít đổi |

**Điều chỉnh độ khó động (DDA).** Hệ thống Hamlet của Robin Hunicke trên engine Half-Life theo dõi sức khỏe người chơi và xác suất cạn tài nguyên, rồi can thiệp phản ứng (đổi độ chính xác, sát thương của địch đang đánh) hoặc chủ động (đổi loại địch sẽ xuất hiện). Chính bài báo cảnh báo: DDA chuyển quyền kiểm soát từ nhà thiết kế sang code, can thiệp chủ động có thể gây hành vi thất thường, can thiệp phản ứng có thể phá sự nhập tâm, và can thiệp quá thường xuyên làm game nhàm ([Hamlet](https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf)).

**Chọn độ khó.** Bảng chọn Easy/Normal/Hard buộc người chơi chọn trước khi biết game; có thể thiết kế độ khó vào cấu trúc, như Celeste dùng dâu tây tùy chọn và các màn B-side ([Abratabia](https://www.abratabia.com/game-design/difficulty-curves.php)). Các lựa chọn trung gian gồm bộ hỗ trợ tùy chọn và tự giảm độ khó sau thất bại ([Stepico](https://stepico.com/blog/video-game-level-design-and-difficulty-how-to-challenge-players-without-losing-them/)).

**Hàm ý cho AI (suy luận của tôi).** Yêu cầu AI viết kèm mỗi game một bộ kiểm tra giải được, một bot chơi đơn giản và một báo cáo độ khó theo level; chỉ chấp nhận level mới khi báo cáo cho thấy đường cong vẫn đi lên và mọi level đều giải được.

## Sinh nội dung tự động (PCG) và LLM

LLM có thể sinh level, nhưng chất lượng phụ thuộc nhiều vào dữ liệu và luôn cần bộ kiểm chứng bên ngoài. Các phương pháp PCG cổ điển cho cấu trúc có bảo đảm mà LLM không tự có.

**Sách nền: Procedural Content Generation in Games** (Shaker, Togelius, Nelson, Springer, 2016). Toàn bộ 12 chương và phụ lục phỏng vấn nhà thiết kế được đăng miễn phí tại [pcgbook.com](http://pcgbook.com). Theo hướng của bạn, tôi đề xuất đọc trước các chương sau:

- Chương 2, tiếp cận dựa trên tìm kiếm (search-based): sinh nội dung rồi chấm điểm theo tiêu chí.
- Chương 3, các phương pháp xây dựng cho dungeon và level.
- Chương 6, luật và cơ chế.
- Chương 10, góc nhìn lấy trải nghiệm người chơi làm trung tâm.
- Chương 12, đánh giá bộ sinh nội dung.

**Level Generation Through Large Language Models** (Todd và cộng sự, 2023). Nhóm tác giả thử GPT-2 và GPT-3 sinh level Sokoban ([arXiv](https://arxiv.org/pdf/2302.05817)):

- Điểm tổng của GPT-2 tăng từ 0,01 (0,1% dữ liệu) lên 0,53 (toàn bộ bộ dữ liệu Boxoban), nên dữ liệu ít cho kết quả rất kém.
- Một level chỉ được tính là chơi được khi hợp lệ về hình dạng, có đúng một người chơi, số hộp bằng số đích và giải được bằng thuật toán A\* trong 150.000 bước. Mô hình huấn luyện đủ dữ liệu đạt 0,54 về tính chơi được.
- Điều khiển theo tỉ lệ ô trống thành công (độ chính xác 1,00), nhưng điều khiển theo độ dài lời giải thất bại (0,17).
- Bài học (suy luận của tôi): luôn kiểm tra level bằng solver riêng, và đừng trông chờ LLM tự chỉnh độ khó chỉ bằng lời nhắc.

**Biến đổi đường cong độ khó bằng hàm** (Sarkar và Cooper, 2019). Bài này mô hình đường cong như một hàm từ năng lực người chơi sang tỉ lệ thua mong muốn, rồi làm mượt, làm dốc, dịch hoặc đảo đường cong bằng cách hợp hàm. Thử với 400 người trong game giải đố Paradox: đường dễ hơn giúp hoàn thành nhiều level hơn và tăng cảm giác năng lực, đường khó hơn đẩy level cao nhất lên, còn mức thích thú không khác biệt đáng kể ([NSF](https://par.nsf.gov/servlets/purl/10133937)).

**Từ GDD đến prototype.** Một nghiên cứu dựng hệ thống biến Game Design Document thành prototype Unity bằng mô hình LLaMA-3 tinh chỉnh, đạt điểm trung bình 4,8/5,0 ([arXiv](https://arxiv.org/abs/2509.08847v1)). Lưu ý: các chỉ số đo là biên dịch được, bám GDD, thực hành tốt và tính module của mã, chứ không đo game chơi có hay không.

## AI slop: vì sao game do AI làm hay thành rác

Game do AI sinh thường nông vì prompt ngắn chỉ mô tả bề mặt cơ chế, nên kết quả là một vòng lặp đơn, độ khó đứng yên và không có cảm giác tiến bộ ([Pulse](https://www.pulse.bot/gaming/news/why-ai-generated-games-lack-depth-and-how-to-add-it-9c85dc98-1e0f-4aa0-a6f6-265ec96fdecd)).

**Nguyên nhân được các bài nêu**

- Prompt đơn giản chỉ cho ra cơ chế cơ bản, không có hệ thống tiến triển; người chơi chán trong vài phút ([Pulse](https://www.pulse.bot/gaming/news/why-ai-generated-games-lack-depth-and-how-to-add-it-9c85dc98-1e0f-4aa0-a6f6-265ec96fdecd)).
- Slop trước hết là vấn đề con người: thiếu tâm huyết, AI chỉ giúp "về đích" nhanh. Vì AI làm game dễ hàng loạt nên các ví dụ yếu cũng bị thấy nhiều hơn ([Ziva](https://ziva.sh/blogs/ai-slop-games), quan điểm của một tác giả, không phải nghiên cứu).
- AI agent làm trọn một tính năng gameplay rất mong manh, vì nó bỏ sót những quyết định thiết kế nhỏ mà người làm game lâu năm sẽ bắt được. Art do AI sinh chỉ hợp làm tham chiếu và placeholder ([Luden.io](https://blog.luden.io/ai-agents-in-game-development-real-production-lessons-failed-experiments-and-workshop-101-7d71e64685fa)).

**Cách tránh**

- Thêm chiều sâu từng lớp: lựa chọn có đánh đổi, hệ thống tiến triển (cây nâng cấp, mở khóa dần), môi trường phản ứng với người chơi, chút cốt truyện qua bối cảnh. Thêm một lớp, test, rồi mới thêm lớp tiếp ([Pulse](https://www.pulse.bot/gaming/news/why-ai-generated-games-lack-depth-and-how-to-add-it-9c85dc98-1e0f-4aa0-a6f6-265ec96fdecd)).
- Chạy playtest ngắn 5–10 phút để thấy ngay chỗ người chơi tụt hứng ([Pulse](https://www.pulse.bot/gaming/news/why-ai-generated-games-lack-depth-and-how-to-add-it-9c85dc98-1e0f-4aa0-a6f6-265ec96fdecd)).
- Dùng AI để thử nhiều ý tưởng nhanh hơn, rồi chọn cơ chế có cá tính thay vì chấp nhận bản đầu tiên ([Ziva](https://ziva.sh/blogs/ai-slop-games)).
- Giữ con người ở phần cảm giác chơi và trực giác thiết kế; giao cho AI những việc hẹp, rõ phạm vi ([Luden.io](https://blog.luden.io/ai-agents-in-game-development-real-production-lessons-failed-experiments-and-workshop-101-7d71e64685fa)).

## Quy trình làm game cùng AI agent

Đưa AI một bộ tài liệu ngắn và cố định, rồi bắt nó làm từng bước nhỏ có kiểm thử. Ba nguồn dưới đây cho ba góc nhìn bổ sung nhau.

**Quy trình từng bước của repo [EnzeD/vibe-coding](https://github.com/EnzeD/vibe-coding)**

1. Nhờ AI soạn `game-design-document.md` từ ý tưởng của bạn, giữ đơn giản và tinh chỉnh sau.
2. Chọn tech stack đơn giản, bền, lưu vào `tech-stack.md`.
3. Sinh luật dự án bằng `/init`, ưu tiên nhiều file module thay vì một file lớn. Đánh dấu luật "Always", như đọc kiến trúc và GDD trước khi viết code, cập nhật kiến trúc sau thay đổi lớn.
4. Lập `implementation-plan.md`: mỗi bước nhỏ, có kiểm thử, không chứa code.
5. Tạo thư mục `memory-bank` gồm GDD, tech stack, kế hoạch, `progress.md` và `architecture.md`.
6. Cho AI đọc memory bank và liệt kê câu hỏi, bạn trả lời rồi cập nhật kế hoạch.
7. Làm từng bước: bạn tự chạy test, chỉ sang bước sau khi test qua; AI ghi lại tiến độ và mục đích từng file.
8. Commit vào Git, mở chat mới để context còn rộng, rồi lặp lại cho bước kế tiếp.
9. Tính năng mới có file riêng, bước ngắn, có test; nếu hỏng thì quay về commit gần nhất.

**Tài liệu thiết kế cho agent.** Skill [game-design-docs](https://www.skills.sh/lvtd-llc/skills/game-design-docs) (dựa trên *The Art of Game Design* của Jesse Schell, theo lời skill) đề ra các quy tắc sau:

- Tài liệu đủ ngắn để luôn cập nhật, đủ cụ thể để ràng buộc việc cài đặt.
- Tách ý định thiết kế ổn định khỏi chi tiết cài đặt hay đổi.
- Ghi lại quyết định, phương án đã bị loại (để agent không đề xuất lại), câu hỏi còn mở và bằng chứng kiểm chứng.
- Liên kết tài liệu với code, dữ liệu, test; cập nhật sau mỗi quyết định thiết kế, không phải sau mỗi sửa nhỏ.

**Bài học thực tế từ studio [Luden.io](https://blog.luden.io/ai-agents-in-game-development-real-production-lessons-failed-experiments-and-workshop-101-7d71e64685fa)**

- AI làm tốt: review hiệu năng, sửa lỗi khi có log và stack trace dạng văn bản, gợi ý kịch bản QA, review design doc như review một diff, tự động hóa và prototype độc lập.
- AI làm kém: làm trọn một tính năng gameplay, tự playtest từ đầu đến cuối, art sản xuất, UI engine phức tạp, chỉnh scene phức tạp. Nhiều file "đặc biệt" kiểu Knowledge.md không cải thiện rõ rệt kết quả.
- Lưu design doc dạng Markdown cạnh project, kèm nguyên tắc thiết kế và các lỗi thiết kế studio hay mắc để agent đối chiếu khi review.
- Một tài liệu quá lớn khiến agent báo thiếu cả những chi tiết hiển nhiên. Tách thành tài liệu lõi cộng phụ lục theo hệ thống con giúp ích, và kiến trúc module hóa với trạng thái xem được dưới dạng văn bản giúp agent làm việc hiệu quả hơn.

Kết luận của Luden.io: agent hợp với việc hẹp và rõ phạm vi; trực giác thiết kế và trải nghiệm người chơi vẫn cần con người.

## Bộ quy tắc và mẫu GDD để dán cho AI

Hai khối dưới đây là bản tổng hợp của tôi từ các nguồn ở trên, không trích nguyên văn nguồn nào. Dán khối đầu vào file luật dự án (ví dụ `CLAUDE.md`) và dùng khối sau làm khung cho `game-design-document.md`. Hãy chỉnh theo thể loại game của bạn.

**Quy tắc cho AI**

```markdown
# Quy tắc thiết kế game

## Trước khi làm
1. Đọc game-design-document.md, architecture.md, progress.md. Không đoán điều tài liệu chưa ghi; ghi thành câu hỏi mở và hỏi lại.
2. Mỗi lần chỉ làm một bước của implementation-plan.md, chạy test, rồi ghi vào progress.md.

## Độ khó
3. Chọn một kiểu đường cong (mặc định: răng cưa) và ghi vào GDD.
4. Mỗi level có một "thẻ level": cơ chế được dạy, bước (giới thiệu / phát triển / twist / kết), kỹ năng tiên quyết, điều kiện thắng, điểm độ khó, lý do khó hơn level trước.
5. Mỗi level chỉ một ý tưởng chính. Không đưa hai cơ chế mới vào cùng lúc.
6. Tăng độ khó bằng cách ghép các cơ chế đã dạy. Cơ chế chưa dạy không được xuất hiện trong thử thách.
7. Sau mỗi đỉnh khó có một đoạn dịu. Mọi đòn nguy hiểm phải có báo hiệu để người chơi đọc được.

## Chống nội dung rác
8. Không thêm nội dung chỉ để lấp chỗ. Mỗi địch, vật phẩm, level phải có vai trò được giải thích trong GDD.
9. Mỗi lần chỉ thêm một lớp chiều sâu (lựa chọn đánh đổi, tiến triển, môi trường phản ứng) và test sau mỗi lớp.
10. Art và âm thanh do AI sinh chỉ là placeholder; ghi rõ trong progress.md.
11. Không tự thêm file hay tính năng ngoài kế hoạch.

## Kiểm chứng
12. Viết bộ kiểm tra "giải được" cho mọi level: tới được lối thắng, chìa có trước khóa, không có tình huống chết bắt buộc.
13. Viết một bot chơi đơn giản, chạy hàng nghìn lượt, xuất báo cáo tỉ lệ thắng, thời gian và tài nguyên còn lại theo từng level.
14. Chỉ nhận level mới khi báo cáo cho thấy độ khó không tụt so với level trước và không có gai bất thường.
15. Giữ thư viện seed tham chiếu và chạy lại sau mỗi lần sửa bộ sinh level.
```

**Mẫu GDD ngắn**

```markdown
# [Tên game]

## 1. Trải nghiệm cốt lõi
(1–2 câu: người chơi cảm thấy gì, làm gì.)

## 2. Vòng lặp chính
Hành động → kết quả → phần thưởng → hành động tiếp theo.

## 3. Cơ chế theo thứ tự được dạy
| # | Cơ chế | Dạy ở level | Ghép được với |
| --- | --- | --- | --- |
| 1 |  |  |  |

## 4. Đường cong độ khó
Kiểu: răng cưa. Thang 1–10. Mỗi đỉnh cao hơn đỉnh trước một chút.

## 5. Thẻ level (mẫu)
- Cơ chế được dạy:
- Bước: giới thiệu / phát triển / twist / kết
- Kỹ năng tiên quyết:
- Điều kiện thắng:
- Điểm độ khó:
- Vì sao khó hơn level trước:

## 6. Chiều sâu và tiến triển
(Lựa chọn đánh đổi, mở khóa dần, môi trường phản ứng.)

## 7. Phương án đã loại và lý do

## 8. Câu hỏi mở

## 9. Tiêu chí chấp nhận
(Bộ kiểm tra giải được, báo cáo bot, ngưỡng độ khó.)
```

## Danh mục tài liệu

Tính đến 29/10/2026. Các trang dưới đây tôi đã mở và đọc, trừ hai mục cuối nhóm 2 ghi rõ.

**1. Độ khó, flow, đường cong**

- [The flow applied to game design](https://www.gamedeveloper.com/design/the-flow-applied-to-game-design), Game Developer
- [Game Difficulty Curves and Player Flow](https://www.abratabia.com/game-design/difficulty-curves.php), Abratabia
- [Video Game Level Design and Difficulty](https://stepico.com/blog/video-game-level-design-and-difficulty-how-to-challenge-players-without-losing-them/), Stepico
- [Difficulty curves: find the right balance](https://www.pocketgamer.biz/difficulty-curves-find-the-right-balance-and-boost-retention-and-revenue), PocketGamer.biz
- [Transforming Game Difficulty Curves using Function Composition](https://par.nsf.gov/servlets/purl/10133937), Sarkar và Cooper, 2019

**2. Level design**

- [Level design basics](https://www.abratabia.com/game-design/level-design-basics.php), Abratabia
- [Portal](https://www.designer-notes.com/portal/), Designer Notes
- [Nintendo's level design secrets in four steps](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps), MCV (chỉ đọc đoạn trích trong kết quả tìm kiếm)
- [Introduction to Level Design](https://www.slideshare.net/slideshow/introduction-to-level-design-49277472/49277472), SlideShare (chỉ đọc đoạn trích trong kết quả tìm kiếm)

**3. Cân bằng, playtest tự động, độ khó động**

- [Roguelike level generation](https://abratabia.com/procedural-generation/roguelike-levels.php), Abratabia
- [Predicting Game Difficulty and Engagement Using AI Players](https://arxiv.org/pdf/2107.12061), Roohi và cộng sự, 2021
- [Assessing Video Game Balance using Autonomous Agents](https://arxiv.org/pdf/2304.08699)
- [Dungeons & Replicants II](https://antoniosliapis.com/papers/dungeons_replicants_automated_game_balancing_across_multiple_difficulty_dimensions_via_deep_player_behavior_modeling.pdf), Pfau, Liapis, Yannakakis, Malaka
- [Hamlet: dynamic difficulty adjustment](https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf), Robin Hunicke

**4. Sinh nội dung và LLM**

- [Procedural Content Generation in Games](http://pcgbook.com), Shaker, Togelius, Nelson (chương miễn phí)
- [Level Generation Through Large Language Models](https://arxiv.org/pdf/2302.05817), Todd và cộng sự, 2023
- [Automated Unity Game Template Generation from GDDs](https://arxiv.org/abs/2509.08847v1)

**5. AI slop và làm game cùng AI**

- [Why AI-Generated Games Lack Depth and How to Add It](https://www.pulse.bot/gaming/news/why-ai-generated-games-lack-depth-and-how-to-add-it-9c85dc98-1e0f-4aa0-a6f6-265ec96fdecd), Pulse
- [AI slop games](https://ziva.sh/blogs/ai-slop-games), Ziva (quan điểm cá nhân)
- [AI agents in game development: real production lessons](https://blog.luden.io/ai-agents-in-game-development-real-production-lessons-failed-experiments-and-workshop-101-7d71e64685fa), Luden.io
- [EnzeD/vibe-coding](https://github.com/EnzeD/vibe-coding), GitHub
- [game-design-docs skill](https://www.skills.sh/lvtd-llc/skills/game-design-docs), skills.sh

**6. Sách nên có**

- *Procedural Content Generation in Games*: [bản miễn phí từng chương](http://pcgbook.com) và [trang của Springer](https://link.springer.com/978-3-319-42714-0).
- *Game Balance* của Ian Schreiber và Brenda Romero: ba phần gồm nguyên lý cân bằng, toán học của cân bằng và bảng tính, có bài tập cuối chương ([Taylor & Francis](https://www.taylorfrancis.com/books/9781315156422)). Tôi chưa đọc nội dung sách.
- *The Art of Game Design* của Jesse Schell: được skill game-design-docs nhắc tới làm nguồn; tôi chưa đọc sách.
