/**
 * スプレッドシートを開いたときにカスタムメニューを追加する simple trigger。
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('ｽﾌﾟﾚｯﾄﾞｼｰﾄ管理')
      .addItem('選手を追加', 'showAddPlayerDialog')
      .addSeparator() // メニューに区切り線を追加
      .addItem('試合記録を削除', 'showDeleteGameDialog') // ★新規追加: 試合削除のメニュー
      .addToUi();
}

// --- 選手追加マクロ (変更なし) ---
function showAddPlayerDialog() {
  const ui = SpreadsheetApp.getUi();
  const numberResponse = ui.prompt('新しい選手を追加', '背番号を入力してください：', ui.ButtonSet.OK_CANCEL);
  if (numberResponse.getSelectedButton() !== ui.Button.OK || numberResponse.getResponseText().trim() === '') return;
  const playerNumber = numberResponse.getResponseText().trim();
  const nameResponse = ui.prompt('新しい選手を追加', `背番号 ${playerNumber} の選手名を入力してください：`, ui.ButtonSet.OK_CANCEL);
  if (nameResponse.getSelectedButton() !== ui.Button.OK || nameResponse.getResponseText().trim() === '') return;
  const playerName = nameResponse.getResponseText().trim();
  addPlayerAndSort(playerNumber, playerName);
}

function addPlayerAndSort(playerNumber, playerName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('選手名簿');
  if (!sheet) {
    SpreadsheetApp.getUi().alert("エラー: '選手名簿' シートが見つかりません。");
    return;
  }
  sheet.appendRow([playerNumber, playerName]);
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  dataRange.sort({column: 1, ascending: true});
  SpreadsheetApp.getUi().alert(`背番号 ${playerNumber} ${playerName} 選手を追加しました。`);
}


// --- ★★★ ここからが新しく追加した試合削除のマクロ ★★★ ---

/**
 * 試合削除用のダイアログを表示する関数。
 */
function showDeleteGameDialog() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '試合記録の削除',
    '削除したい試合の「試合名」または「試合ID」を入力してください：',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText().trim() === '') {
    return; // キャンセルまたは入力が空なら終了
  }
  
  const searchInput = response.getResponseText().trim();
  deleteGameByInput(searchInput);
}

/**
 * 入力された文字列を元に、試合一覧と試合シートを検索して削除するメイン関数。
 * @param {string} searchInput - ユーザーが入力した試合名または試合ID。
 */
function deleteGameByInput(searchInput) {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gameListSheet = ss.getSheetByName('試合一覧');

  if (!gameListSheet || gameListSheet.getLastRow() < 2) {
    ui.alert('エラー: 試合データが見つかりません。');
    return;
  }
  
  // 試合一覧シートの全データを取得 (A列: 試合ID, B列: 試合名)
  const gameListData = gameListSheet.getRange(2, 1, gameListSheet.getLastRow() - 1, 2).getValues();
  
  let targetRowIndex = -1;
  let targetGameId = '';
  let targetGameName = '';

  // 入力された値で試合IDまたは試合名を検索
  for (let i = 0; i < gameListData.length; i++) {
    const gameId = gameListData[i][0];
    const gameName = gameListData[i][1];
    if (String(gameId).trim() === searchInput || String(gameName).trim() === searchInput) {
      targetRowIndex = i + 2; // 配列のインデックス+2が実際のシート上の行番号
      targetGameId = gameId;
      targetGameName = gameName;
      break;
    }
  }

  // 試合が見つからなかった場合
  if (targetRowIndex === -1) {
    ui.alert(`'${searchInput}' に一致する試合が見つかりませんでした。`);
    return;
  }
  
  // 試合が見つかった場合、最終確認ダイアログを表示
  const confirmMessage = `以下の試合記録を完全に削除します。よろしいですか？\n\n試合ID: ${targetGameId}\n試合名: ${targetGameName}\n\nこの操作は元に戻せません。`;
  const confirmResponse = ui.alert('最終確認', confirmMessage, ui.ButtonSet.YES_NO);

  if (confirmResponse === ui.Button.YES) {
    // 試合専用シートの削除を試みる
    const gameSheetToDelete = ss.getSheetByName(`Game_${targetGameId}`);
    if (gameSheetToDelete) {
      ss.deleteSheet(gameSheetToDelete);
    }
    
    // 「試合一覧」シートから該当行を削除
    gameListSheet.deleteRow(targetRowIndex);
    
    ui.alert(`'${targetGameName}' の試合記録を削除しました。`);
  } else {
    ui.alert('削除をキャンセルしました。');
  }
}
