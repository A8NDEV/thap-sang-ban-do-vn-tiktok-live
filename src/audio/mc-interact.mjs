// Câu MC mời tương tác khi tắt "MC kêu gọi tặng quà": thả tim, follow, bình luận tên quê, chia sẻ live.
// Dữ liệu thuần + bộ chọn nhỏ (không I/O, không đụng cài đặt). Không nhắc quà / xu / phần thưởng bằng tiền.
export const INTERACT_CATS = ['tim', 'follow', 'comment', 'share'];

export const INTERACT_LINES = {
  tim: [
    'Bà con ơi, thả tim giúp mình nhé, mỗi trái tim là một lời chúc cho cả phòng live đó.',
    'Đồng hương ơi, bấm đúp lên màn hình để thả tim cho quê mình nào!',
    'Thả tim thật nhiều để phòng live mình thêm rộn ràng nhé bà con.',
    'Bà con thương thì thả cho mình vài trái tim, mình cảm ơn nhiều lắm.',
    'Ai đang xem live thì nhớ thả tim ủng hộ kênh nha, tim bay lên là vui cả nhà.',
    'Một trái tim nhỏ thôi cũng làm cả phòng ấm áp hơn đó bà con.',
    'Đồng hương nào đang ở xa quê, thả một trái tim gửi về quê nhà nhé.',
    'Chạm tay vào màn hình thả tim nào bà con, cho phòng live thêm tưng bừng!',
    'Cảm ơn bà con đã ở lại xem live, thả tim cho mình có thêm động lực nhé.',
    'Tim bay đầy màn hình thì đẹp lắm đó, bà con thả tim cùng mình nha.',
    'Bà con yêu quê hương thì thả tim cái nào, mình cùng nhau thắp sáng bản đồ Việt Nam.',
    'Thả tim cho mình nghe bà con ơi, để đêm nay phòng live thật ấm áp.',
    'Bà con rảnh tay thì thả tim cho phòng live thêm duyên nha.',
    'Thả tim đi bà con ơi, mỗi trái tim là một cái ôm gửi tới cả nhà.',
  ],
  follow: [
    'Bà con thấy vui thì bấm Follow kênh nhé, để tối nào cũng gặp lại nhau thắp đèn.',
    'Đồng hương ơi, bấm theo dõi kênh để không lỡ những buổi live thắp sáng bản đồ nha.',
    'Chưa follow thì bà con bấm nút Follow giúp mình nhé, mình cảm ơn nhiều.',
    'Follow kênh để cùng mình đi hết 34 tỉnh, thành trên bản đồ nào bà con.',
    'Bà con nào mới vào phòng thì nhớ bấm Follow kênh, mỗi lượt follow quê mình được cộng điểm đó.',
    'Muốn mai còn gặp lại nhau thì bà con bấm Follow kênh nha.',
    'Một lượt Follow của bà con là một lời động viên rất lớn với mình đó.',
    'Đồng hương bấm theo dõi kênh để lần sau vào là gặp lại bà con liền nhé.',
    'Bấm Follow kênh để cùng cộng đồng thắp đèn mỗi tối, vui lắm bà con ơi.',
    'Bà con bấm Follow để mình biết ai là đồng hương của mình nhé.',
    'Follow kênh nha bà con, mình còn nhiều trò hay như câu đố và đại chiến các quê nữa.',
    'Đồng hương ơi, chưa theo dõi kênh thì bấm giúp mình một cái nha.',
    'Bấm Follow để mình nhớ mặt từng đồng hương của kênh nhé bà con.',
  ],
  comment: [
    'Đồng hương ơi, gõ tên tỉnh quê bạn vào phần bình luận là đèn quê mình sáng ngay.',
    'Quê bạn ở đâu? Bình luận cho cả phòng biết nào bà con.',
    'Mỗi bình luận là một điểm cho quê mình, bà con gõ tên quê thật nhiều nhé.',
    'Bà con cứ gõ không dấu cũng được, Hà Nội, Huế, Cần Thơ, mình đều nhận ra hết.',
    'Tỉnh nào chưa sáng đèn thì đồng hương vào bình luận tên quê để thắp lên nha.',
    'Ai ở xa quê thì bình luận tên quê mình, cho cả phòng biết bà con đang nhớ về đâu.',
    'Bình luận tên tỉnh, thành của bạn để cùng mình thắp sáng trọn vẹn bản đồ Việt Nam nào.',
    'Bà con ơi, quê mình đứng thứ mấy trên bảng đua là nhờ những bình luận của mình đó.',
    'Gõ tên quê vào khung chat để ngọn đèn quê bạn nháy sáng trên bản đồ nhé bà con.',
    'Đồng hương cùng quê thì rủ nhau bình luận tên quê, đèn sẽ sáng rực lên đó.',
    'Chưa kịp bình luận thì bà con gõ tên tỉnh quê mình ngay nhé, mình sẽ đọc tên bà con liền.',
    'Bà con comment tên quê đi, mình đọc to tên quê bà con lên cho cả phòng nghe nè.',
    'Quê bạn có đèn sáng chưa? Gõ tên tỉnh vào khung bình luận để kiểm tra nào.',
  ],
  share: [
    'Bà con chia sẻ phiên live này cho bạn bè và đồng hương để cùng vào thắp đèn nhé.',
    'Đồng hương ơi, bấm nút chia sẻ rủ người quê mình vào thắp sáng bản đồ nào.',
    'Thấy vui thì bà con share live cho người thân nha, càng đông càng náo nhiệt.',
    'Bà con gửi link phiên live này vào nhóm Zalo đồng hương để mọi người cùng vào nhé.',
    'Chia sẻ live cho bạn bè ở quê, để cả nhà cùng thắp đèn cho quê hương nào.',
    'Bà con nào có nhóm bạn cùng quê thì chia sẻ live vào nhóm giúp mình nha.',
    'Rủ thêm bạn bè vào phòng bằng cách bấm chia sẻ, mình cảm ơn bà con rất nhiều.',
    'Bấm nút chia sẻ để mời đồng hương vào đây thắp đèn cho quê nhà nhé.',
    'Đồng hương xa quê đừng quên chia sẻ phiên live này cho người thân ở nhà cùng xem nha.',
    'Một lượt chia sẻ của bà con giúp bản đồ sáng nhanh hơn đó, cảm ơn bà con.',
    'Bà con share live này cho bạn bè để cả nhà cùng thắp sáng bản đồ Việt Nam nhé.',
    'Bà con rủ thêm một người thân cùng vào phòng này bằng nút chia sẻ nha.',
    'Chia sẻ phiên live này lên trang cá nhân để bạn bè quê mình biết mà ghé vào thắp đèn nhé.',
  ],
};

export const allInteractLines = () => INTERACT_CATS.flatMap(c => INTERACT_LINES[c]);

// Bộ chọn: xoay vòng 4 nhóm (tim → follow → comment → share), trong mỗi nhóm lần lượt hết câu mới xáo lại,
// câu đầu của lượt xáo mới không trùng câu cuối lượt trước. rand tiêm vào để test.
export function createInteractPicker(rand = Math.random){
  let ci = 0, bags = {}, last = {};
  const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return {
    next(){
      const cat = INTERACT_CATS[ci++ % INTERACT_CATS.length];
      let bag = bags[cat];
      if (!bag?.length) {
        bag = shuffle(INTERACT_LINES[cat]);
        if (bag.length > 1 && bag[bag.length - 1] === last[cat]) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        bags[cat] = bag;
      }
      const line = bag.pop(); last[cat] = line;
      return { cat, line };
    },
    reset(){ ci = 0; bags = {}; last = {}; },
  };
}
