// ============================================
// CaseForMe - 맞춤형 경영 케이스 스터디 챗봇
// LLM 기반 동적 케이스 생성 + 인사이트 도출
// ============================================

const App = (() => {
  // ---- State ----
  const state = {
    phase: 'welcome',
    profile: { industry: '', role: '', experience: '' },
    answers: { q1: '', q1Follow: '', q2: '', q2Follow: '', q3: '', q3Follow: '', q4: '', q4Follow: '' },
    currentCase: null,
  };

  // ---- DOM ----
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const quickReplies = document.getElementById('quick-replies');
  const inputHint = document.getElementById('input-hint');
  const floatingCaseBtn = document.getElementById('floating-case-btn');
  const casePanel = document.getElementById('case-panel');
  const casePanelBody = document.getElementById('case-panel-body');
  const casePanelOverlay = document.getElementById('case-panel-overlay');

  // ---- LLM API Call (via serverless proxy) ----
  async function callLLM(systemPrompt, userPrompt, maxTokens = 8192) {
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userPrompt, maxTokens })
      });

      if (!res.ok) {
        console.error('API Error:', res.status);
        return null;
      }

      const data = await res.json();
      return data.content;
    } catch (err) {
      console.error('Network Error:', err);
      return null;
    }
  }

  // ========================================
  // System Prompts
  // ========================================

  // 1. 프로필 기반 맞춤 케이스 생성 (MBA 교수법 기반 다중 이해관계자 구조)
  function getCaseGenerationPrompt() {
    return `당신은 MBA 케이스 스터디 전문가입니다. 사용자의 프로필에 맞춰 다중 이해관계자가 등장하는 현실적인 경영 케이스를 생성하세요.

사용자 프로필:
- 업종: ${state.profile.industry}
- 직급/역할: ${state.profile.role}
- 경력: ${state.profile.experience}

직급별 케이스 난이도 규칙 (반드시 준수):
- 주인공의 의사결정 범위는 사용자의 직급에 현실적으로 맞아야 합니다.
- 사원/대리/주임 (1~4년차): 주인공은 실무 담당자. 팀 내 업무 방식 개선, 상사에게 제안서 작성, 부서 간 협업 갈등 조율, 프로젝트 실행 방법 선택 등 "실무 레벨의 판단과 상향 제안"이 핵심. CEO급 전사 의사결정은 절대 부여하지 마세요.
- 과장/차장 (5~9년차): 주인공은 중간관리자. 팀 운영, 부서 간 이해관계 조율, 리소스 배분, 상위 의사결정자에게 보고/설득 등 "중간 레벨의 의사결정과 리더십"이 핵심.
- 부장/팀장 이상 (10년차+): 주인공은 의사결정권자. 사업 방향, 조직 개편, 전략적 투자 판단 등 "경영 레벨의 의사결정"이 가능.

케이스 생성 규칙:
1. 배경 설정 (3-4문장): 업종, 회사 규모, 현재 상황을 구체적으로 제시하세요.
2. 주인공 (2-3문장): 사용자와 비슷한 직급/경력의 인물이어야 하며, 해당 직급이 현실적으로 마주할 수 있는 상황이어야 합니다.
3. 이해관계자 3-4명: 각각 이름, 역할, 입장이 다른 인물을 등장시키세요.
   - 최소 2명은 정당하지만 서로 상충하는 이해관계를 가져야 합니다.
   - 각 인물의 배경과 동기를 구체적으로 묘사하세요.
4. 핵심 사건 (2-3문장): 의사결정을 촉발하는 구체적 사건을 넣으세요.
5. 참고 데이터 (4-5개): 최소 1개는 해석이 갈리는 모호한 데이터를 포함하세요.
6. 제약 조건 (2-3개): 시간, 자원, 관계적 제약을 명시하세요.
7. 케이스 본문은 4~5단락으로 작성하세요. 정답이 없는 진정한 딜레마여야 합니다.

질문 설계 규칙 (MBA 교수법 Q1-Q4 구조):
- q1 (이해관계자 진단): 케이스에 등장하는 핵심 이해관계자들의 입장과 관점을 각각 분석하게 하는 질문
- q2 (핵심 딜레마 정의): 이 상황이 왜 쉽게 해결되지 않는 문제인지, 핵심 딜레마를 구조화하게 하는 질문
- q3 (의사결정 + 실행 계획): "당신이 [주인공]이라면" 해당 직급 범위 내에서 어떤 판단을 내리고, Q1의 이해관계자 반응을 고려하여 어떻게 실행할지 묻는 질문
- q4 (리스크 평가 + 대안 검증): 자신의 계획이 실패할 가능성과 정반대 접근의 장단점을 성찰하게 하는 질문

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트를 추가하지 마세요.

{
  "title": "케이스 제목 (회사명 + 상황 요약)",
  "body": "케이스 본문 (단락 사이는 \\n\\n으로 구분)",
  "data": ["데이터1", "데이터2", "데이터3", "데이터4", "데이터5"],
  "q1": "이해관계자 진단 질문",
  "q1Hint": "사고 방향 힌트 (1문장)",
  "q2": "핵심 딜레마 정의 질문",
  "q3": "의사결정 + 실행 계획 질문",
  "q4": "리스크 평가 + 대안 검증 질문"
}`;
  }

  // 2. 후속 질문 생성 (MBA 교수 인정-도전-연결 패턴)
  function getFollowUpPrompt(qNum) {
    const caseInfo = `[케이스]\n제목: ${state.currentCase.title}\n내용: ${state.currentCase.body}\n데이터: ${state.currentCase.data.join(' / ')}`;
    const profileInfo = `[사용자 프로필]\n업종: ${state.profile.industry}, 직급: ${state.profile.role}, 경력: ${state.profile.experience}`;

    const qContext = {
      q1: `질문: "${state.currentCase.q1}"`,
      q2: `질문: "${state.currentCase.q2}"\n\n사용자의 Q1 답변: "${state.answers.q1}"`,
      q3: `질문: "${state.currentCase.q3}"\n\n사용자의 Q1 답변: "${state.answers.q1}"\n사용자의 Q2 답변: "${state.answers.q2}"`,
      q4: `질문: "${state.currentCase.q4}"\n\n사용자의 Q1 답변: "${state.answers.q1}"\n사용자의 Q2 답변: "${state.answers.q2}"\n사용자의 Q3 답변: "${state.answers.q3}"`,
    };

    return `당신은 MBA 케이스 스터디 교수입니다. 사용자가 케이스 질문에 답변했습니다.
"인정-도전-연결" 패턴으로 후속 질문을 1개만 던져주세요.

패턴:
1. 인정: 사용자가 잘 파악한 점을 구체적으로 짚어 인정하세요. (1문장)
2. 도전: 사용자가 놓친 관점, 전제, 또는 논리적 빈틈을 부드럽게 지적하며 후속 질문을 던지세요. (1문장)
3. 연결(선택): 다음 질문과 자연스럽게 연결되는 브릿지가 필요하면 짧게 추가하세요.

규칙:
1. 반드시 한국어로 답변하세요.
2. 2~3문장으로 짧게 답변하세요.
3. 절대 정답을 말하지 마세요. 질문만 던지세요.
4. 마크다운이나 특수 형식을 쓰지 마세요. 일반 텍스트로만 답변하세요.

${profileInfo}

${caseInfo}

${qContext[qNum]}`;
  }

  // 3. 인사이트 리포트 생성 (MBA 교수법 기반 5섹션 구조)
  function getInsightPrompt() {
    return `당신은 MBA 케이스 스터디 전문 코치이자 경영 컨설턴트입니다.
사용자의 프로필과 케이스 답변을 분석하여, 실무에서 바로 활용할 수 있는 맞춤형 인사이트 리포트를 작성해주세요.

[사용자 프로필]
업종: ${state.profile.industry}
직급/역할: ${state.profile.role}
경력: ${state.profile.experience}

[케이스]
제목: ${state.currentCase.title}
내용: ${state.currentCase.body}
데이터: ${state.currentCase.data.join(' / ')}

[사용자 답변]
Q1 (이해관계자 진단): ${state.answers.q1}
Q1 후속 답변: ${state.answers.q1Follow}
Q2 (핵심 딜레마 정의): ${state.answers.q2}
Q2 후속 답변: ${state.answers.q2Follow}
Q3 (의사결정 + 실행 계획): ${state.answers.q3}
Q3 후속 답변: ${state.answers.q3Follow}
Q4 (리스크 평가 + 대안 검증): ${state.answers.q4}
Q4 후속 답변: ${state.answers.q4Follow}

작성 규칙:
1. 반드시 한국어로 답변하세요.
2. 사용자의 업종/직급/경력 맥락에 맞춰 실무적으로 활용 가능한 내용만 제시하세요.
3. 사용자의 실제 답변을 구체적으로 인용하며 분석하세요.
4. 아래 5개 섹션 형식을 정확히 따르세요. 각 섹션은 대괄호로 표시합니다.
5. 마크다운을 쓰지 마세요. 일반 텍스트로만 답변하세요.

형식:

[분석 요약]

사용자의 Q1-Q4 답변을 체계적으로 정리하세요.
→ 근거: 이해관계자 분석에서 사용자가 파악한 핵심 관점
→ 근거: 딜레마 정의에서 사용자가 포착한 핵심 긴장
→ 근거: 의사결정과 실행 계획의 논리적 일관성
→ 근거: 리스크 인식과 대안 사고의 깊이

[${state.profile.industry} ${state.profile.role}로서 고려할 포인트]

1. (사용자가 잘 파악한 첫 번째 강점)
→ 근거: (사용자 답변에서 해당 부분을 구체적으로 인용)

2. (사용자가 놓친 관점이나 보완할 포인트)
→ 근거: (왜 이 관점이 중요한지 케이스 맥락에서 설명)

3. (세 번째 고려 포인트)
→ 근거: (근거)

4. (네 번째 고려 포인트)
→ 근거: (근거)

[관련 경영 프레임워크]

이 케이스에 적용 가능한 경영 이론/프레임워크 1개를 소개하세요.
→ 근거: 프레임워크의 핵심 개념을 1-2문장으로 설명
→ 근거: 이 케이스에 프레임워크를 적용한 구체적 예시
→ 근거: 사용자의 답변이 이 프레임워크 관점에서 어떤 시사점을 가지는지

[핵심 키포인트]

키포인트 1: (이 케이스에서 ${state.profile.role}가 가져가야 할 핵심 교훈)
→ 실무 적용: (실제 업무에서 바로 시도해볼 수 있는 구체적 액션)

키포인트 2: (두 번째 핵심 교훈)
→ 실무 적용: (구체적 액션)

키포인트 3: (세 번째 핵심 교훈)
→ 실무 적용: (구체적 액션)

[실무 적용 질문]

1. 현재 직장에서 이 케이스와 유사한 이해관계 충돌 상황이 있다면 어떤 것인가요?
2. 이 케이스에서 배운 교훈을 내일 당장 업무에 적용한다면 무엇부터 시작하겠습니까?
3. (사용자의 답변 패턴에서 발견한 사고 습관을 기반으로 한 성찰 질문)`;
  }

  // ========================================
  // Utility Functions
  // ========================================

  function scrollToBottom() {
    const chatArea = document.querySelector('.chat-area');
    setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 50);
  }

  function addMessage(type, content) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (type === 'bot') {
      const img = document.createElement('img');
      img.src = 'logo-fki.png';
      img.alt = 'FKI';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:50%;';
      avatar.appendChild(img);
    } else {
      avatar.textContent = 'U';
    }
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (typeof content === 'string') {
      contentDiv.innerHTML = content.replace(/\n/g, '<br>');
    } else {
      contentDiv.appendChild(content);
    }
    msg.appendChild(avatar);
    msg.appendChild(contentDiv);
    chatMessages.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function showTyping() {
    const msg = document.createElement('div');
    msg.className = 'message bot';
    msg.id = 'typing-msg';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    const img = document.createElement('img');
    img.src = 'logo-fki.png';
    img.alt = 'FKI';
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:50%;';
    avatar.appendChild(img);
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    msg.appendChild(avatar);
    msg.appendChild(contentDiv);
    chatMessages.appendChild(msg);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById('typing-msg');
    if (el) el.remove();
  }

  function botSay(text, delay = 600) {
    return new Promise(resolve => {
      showTyping();
      setTimeout(() => { hideTyping(); addMessage('bot', text); resolve(); }, delay);
    });
  }

  function botSayHTML(htmlElement, delay = 600) {
    return new Promise(resolve => {
      showTyping();
      setTimeout(() => { hideTyping(); addMessage('bot', htmlElement); resolve(); }, delay);
    });
  }

  async function botSayLLM(systemPrompt, userPrompt) {
    showTyping();
    const reply = await callLLM(systemPrompt, userPrompt);
    hideTyping();
    if (reply) {
      addMessage('bot', reply);
      return reply;
    } else {
      addMessage('bot', '죄송합니다. 응답을 생성하지 못했습니다. 다시 시도해주세요.');
      return null;
    }
  }

  function showFloatingCaseBtn() {
    if (state.currentCase) {
      floatingCaseBtn.style.display = 'flex';
    }
  }

  function hideFloatingCaseBtn() {
    floatingCaseBtn.style.display = 'none';
  }

  function openCasePanel() {
    if (!state.currentCase) return;
    casePanelBody.innerHTML = '';
    casePanelBody.appendChild(createCaseCard(state.currentCase));
    casePanel.classList.add('open');
    casePanelOverlay.classList.add('visible');
  }

  function showQuickReplies(options) {
    quickReplies.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quick-reply-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => { hideQuickReplies(); handleUserMessage(opt); });
      quickReplies.appendChild(btn);
    });
    quickReplies.style.display = 'flex';
  }

  function hideQuickReplies() {
    quickReplies.style.display = 'none';
    quickReplies.innerHTML = '';
  }

  function setInputHint(text) { inputHint.textContent = text; }

  function updateProgress(activeStep) {
    const steps = document.querySelectorAll('.step');
    const lines = document.querySelectorAll('.step-line');
    const stepOrder = ['profile', 'case', 'q1', 'q2', 'q3', 'q4', 'insight'];
    const activeIdx = stepOrder.indexOf(activeStep);
    steps.forEach((step, i) => {
      step.classList.remove('active', 'completed');
      if (i < activeIdx) step.classList.add('completed');
      if (i === activeIdx) step.classList.add('active');
    });
    lines.forEach((line, i) => { line.classList.toggle('completed', i < activeIdx); });
  }

  function disableInput() {
    userInput.disabled = true;
    sendBtn.disabled = true;
  }

  function enableInput() {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }

  // ========================================
  // Card Creation
  // ========================================

  function createCaseCard(caseData) {
    const card = document.createElement('div');
    card.innerHTML = `
      <div class="case-card">
        <div class="case-card-header"><span>CASE</span><h4>${caseData.title}</h4></div>
        <div class="case-card-body">
          ${caseData.body.split('\n\n').map(p => `<p>${p}</p>`).join('')}
          <div class="case-data">
            <div class="case-data-title">참고 데이터</div>
            <ul>${caseData.data.map(d => `<li>${d}</li>`).join('')}</ul>
          </div>
        </div>
      </div>`;
    return card.firstElementChild;
  }

  function createQuestionCard(label, text, hint) {
    const card = document.createElement('div');
    card.innerHTML = `
      <div class="question-card">
        <span class="question-label">${label}</span>
        <div class="question-text">${text}</div>
        ${hint ? `<div class="question-hint">${hint}</div>` : ''}
      </div>`;
    return card.firstElementChild;
  }

  function createSummaryCard(answers) {
    const card = document.createElement('div');
    card.innerHTML = `
      <div class="summary-card">
        <h4>당신의 답변 요약</h4>
        <div class="summary-item"><span class="summary-label">Q1</span><span class="summary-text">${answers.q1}${answers.q1Follow ? '<br><em style="color:#5C6270;">+ ' + answers.q1Follow + '</em>' : ''}</span></div>
        <div class="summary-item"><span class="summary-label">Q2</span><span class="summary-text">${answers.q2}${answers.q2Follow ? '<br><em style="color:#5C6270;">+ ' + answers.q2Follow + '</em>' : ''}</span></div>
        <div class="summary-item"><span class="summary-label">Q3</span><span class="summary-text">${answers.q3}${answers.q3Follow ? '<br><em style="color:#5C6270;">+ ' + answers.q3Follow + '</em>' : ''}</span></div>
        <div class="summary-item"><span class="summary-label">Q4</span><span class="summary-text">${answers.q4}${answers.q4Follow ? '<br><em style="color:#5C6270;">+ ' + answers.q4Follow + '</em>' : ''}</span></div>
      </div>`;
    return card.firstElementChild;
  }

  // 인사이트 리포트 카드 생성
  function createInsightCard(insightText) {
    const card = document.createElement('div');
    const lines = insightText.split('\n').filter(l => l.trim());
    let html = '<div class="insight-card"><div class="insight-card-header">맞춤형 인사이트 리포트</div>';

    let currentSection = '';
    let items = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // 이전 섹션 flush
        if (items.length > 0) {
          html += buildInsightSection(currentSection, items);
          items = [];
        }
        currentSection = trimmed.slice(1, -1);
      } else if (trimmed) {
        items.push(trimmed);
      }
    }
    // 마지막 섹션 flush
    if (items.length > 0) {
      html += buildInsightSection(currentSection, items);
    }

    html += '</div>';
    card.innerHTML = html;
    return card.firstElementChild;
  }

  function buildInsightSection(title, items) {
    let html = `<div class="insight-section"><div class="insight-section-title">${title}</div>`;
    let currentItem = '';

    for (const item of items) {
      if (item.startsWith('→ 근거:') || item.startsWith('→ 실무 적용:')) {
        // 하위 항목 - 이전 메인 항목에 추가
        const subClass = item.startsWith('→ 근거:') ? 'insight-basis' : 'insight-action';
        const subText = item.replace(/^→ (근거|실무 적용): ?/, '');
        currentItem += `<div class="${subClass}">${item.includes('근거') ? '근거: ' : '실무 적용: '}${subText}</div>`;
      } else {
        // 이전 아이템 flush
        if (currentItem) {
          html += `<div class="insight-item">${currentItem}</div>`;
        }
        currentItem = item;
      }
    }
    // 마지막 아이템 flush
    if (currentItem) {
      html += `<div class="insight-item">${currentItem}</div>`;
    }

    html += '</div>';
    return html;
  }

  // ========================================
  // LLM 케이스 생성 & 파싱
  // ========================================

  async function generateCase() {
    showTyping();
    const raw = await callLLM(
      getCaseGenerationPrompt(),
      `${state.profile.industry} 업종의 ${state.profile.role}(${state.profile.experience} 경력)에게 맞는 케이스를 생성해주세요.`
    );
    hideTyping();

    if (!raw) return null;

    try {
      // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
      let jsonStr = raw;
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // { 로 시작하는 부분 찾기
        const braceStart = raw.indexOf('{');
        const braceEnd = raw.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1) {
          jsonStr = raw.substring(braceStart, braceEnd + 1);
        }
      }

      const caseData = JSON.parse(jsonStr);

      // 필수 필드 검증
      if (!caseData.title || !caseData.body || !caseData.data || !caseData.q1 || !caseData.q2 || !caseData.q3) {
        console.error('Missing required fields in case data:', caseData);
        return null;
      }

      // q4가 누락된 경우 기본 질문 생성
      if (!caseData.q4) {
        caseData.q4 = '당신의 결정이 실패한다면 가장 큰 원인은 무엇일까요? 만약 정반대의 결정을 내렸다면 어떤 장단점이 있었을까요?';
      }

      return caseData;
    } catch (err) {
      console.error('JSON Parse Error:', err, '\nRaw:', raw);
      return null;
    }
  }

  // ========================================
  // Phase Handlers
  // ========================================

  async function handleUserMessage(text) {
    if (!text.trim()) return;

    addMessage('user', text);
    userInput.value = '';
    autoResize();
    disableInput();

    switch (state.phase) {
      case 'profile-industry':
        state.profile.industry = text;
        state.phase = 'profile-role';
        await botSay('직급이나 역할은 어떻게 되세요?');
        setInputHint('예: 마케팅 팀장, 개발팀 과장, 영업 담당 등');
        enableInput();
        break;

      case 'profile-role':
        state.profile.role = text;
        state.phase = 'profile-exp';
        await botSay('경력은 몇 년 정도 되셨나요?');
        setInputHint('예: 5년, 12년 등');
        enableInput();
        break;

      case 'profile-exp':
        state.profile.experience = text;
        state.phase = 'case-generating';
        updateProgress('case');
        setInputHint('');

        await botSay(`${state.profile.industry} 업계 ${state.profile.role}(${state.profile.experience} 경력)이시군요.\n프로필에 맞는 맞춤 케이스를 AI가 생성하고 있습니다...`);

        // LLM으로 케이스 동적 생성
        const caseData = await generateCase();

        if (caseData) {
          state.currentCase = caseData;
          state.phase = 'case-read';
          await botSay('맞춤 케이스가 준비되었습니다. 천천히 읽어보세요.', 300);
          await botSayHTML(createCaseCard(caseData), 500);
          await botSay('다 읽으시면 "읽었습니다"라고 말씀해주세요.\n4가지 질문을 드리겠습니다.');
          showQuickReplies(['읽었습니다']);
        } else {
          state.phase = 'profile-exp';
          await botSay('케이스 생성에 실패했습니다. 다시 시도해주세요.\n경력을 다시 입력해주세요.');
        }
        enableInput();
        break;

      case 'case-read':
        state.phase = 'q1';
        updateProgress('q1');
        hideQuickReplies();
        showFloatingCaseBtn();
        await botSay('좋습니다. 첫 번째 질문입니다. 이해관계자들의 입장을 분석해보세요.');
        await botSayHTML(createQuestionCard('Q1 이해관계자 진단', state.currentCase.q1, state.currentCase.q1Hint || ''), 500);
        setInputHint('각 이해관계자의 입장과 관점을 구분하여 작성해주세요');
        enableInput();
        break;

      case 'q1':
        state.answers.q1 = text;
        state.phase = 'q1-follow';
        await botSayLLM(getFollowUpPrompt('q1'), `사용자의 Q1 답변: "${text}"`);
        enableInput();
        break;

      case 'q1-follow':
        state.answers.q1Follow = text;
        state.phase = 'q2';
        updateProgress('q2');
        await botSay('좋습니다. 이제 핵심 딜레마를 정의해봅시다.');
        await botSayHTML(createQuestionCard('Q2 핵심 딜레마', state.currentCase.q2, ''), 500);
        setInputHint('왜 쉽게 해결되지 않는 문제인지 구조화해보세요');
        enableInput();
        break;

      case 'q2':
        state.answers.q2 = text;
        state.phase = 'q2-follow';
        await botSayLLM(getFollowUpPrompt('q2'), `사용자의 Q2 답변: "${text}"`);
        enableInput();
        break;

      case 'q2-follow':
        state.answers.q2Follow = text;
        state.phase = 'q3';
        updateProgress('q3');
        await botSay('알겠습니다. 이제 직접 의사결정을 해볼 차례입니다.');
        await botSayHTML(createQuestionCard('Q3 의사결정 + 실행', state.currentCase.q3, ''), 500);
        setInputHint('결정과 실행 순서를 이해관계자 반응을 고려하여 작성해주세요');
        enableInput();
        break;

      case 'q3':
        state.answers.q3 = text;
        state.phase = 'q3-follow';
        await botSayLLM(getFollowUpPrompt('q3'), `사용자의 Q3 답변: "${text}"`);
        enableInput();
        break;

      case 'q3-follow':
        state.answers.q3Follow = text;
        state.phase = 'q4';
        updateProgress('q4');
        await botSay('좋습니다. 마지막 질문입니다. 자신의 결정을 비판적으로 검증해보세요.');
        await botSayHTML(createQuestionCard('Q4 리스크 + 대안', state.currentCase.q4, ''), 500);
        setInputHint('실패 가능성과 정반대 결정의 장단점을 생각해보세요');
        enableInput();
        break;

      case 'q4':
        state.answers.q4 = text;
        state.phase = 'q4-follow';
        await botSayLLM(getFollowUpPrompt('q4'), `사용자의 Q4 답변: "${text}"`);
        enableInput();
        break;

      case 'q4-follow':
        state.answers.q4Follow = text;
        state.phase = 'insight';
        updateProgress('insight');
        hideFloatingCaseBtn();
        setInputHint('');

        await botSay('4개 질문에 대한 답변이 모두 끝났습니다.\n답변을 분석하여 맞춤형 인사이트 리포트를 생성합니다.');
        await botSayHTML(createSummaryCard(state.answers), 800);

        // LLM으로 인사이트 리포트 생성
        showTyping();
        const insightText = await callLLM(
          getInsightPrompt(),
          `위 사용자의 프로필과 답변을 분석하여 맞춤형 인사이트 리포트를 작성해주세요.`,
          16384
        );
        hideTyping();

        if (insightText) {
          await botSay(`${state.profile.industry} ${state.profile.role}님을 위한 맞춤 인사이트입니다.`, 300);
          const insightCard = createInsightCard(insightText);
          await botSayHTML(insightCard, 300);
        } else {
          await botSay('인사이트 리포트 생성에 실패했습니다. 다시 시도해주세요.');
        }

        state.phase = 'done';
        await botSay('인사이트 중에서 실무에 바로 적용해보고 싶은 포인트가 있으신가요?\n추가 질문이나 다른 케이스도 가능합니다.', 500);
        showQuickReplies(['다른 케이스 해보기', '특정 포인트 더 파고들기']);
        enableInput();
        break;

      case 'done':
        hideQuickReplies();
        if (text.includes('다른 케이스')) {
          // Reset
          chatMessages.innerHTML = '';
          state.phase = 'welcome';
          state.answers = { q1: '', q1Follow: '', q2: '', q2Follow: '', q3: '', q3Follow: '', q4: '', q4Follow: '' };
          state.currentCase = null;
          hideFloatingCaseBtn();
          updateProgress('profile');
          enableInput();
          await startChat();
        } else {
          // 자유 대화 - LLM으로 처리
          await botSayLLM(
            `당신은 MBA 케이스 스터디 코치입니다. 사용자가 인사이트 리포트를 받은 후 추가 질문이나 의견을 남겼습니다.

사용자 프로필: ${state.profile.industry} ${state.profile.role} (${state.profile.experience} 경력)
케이스: ${state.currentCase.title}
사용자 답변 요약 - Q1: ${state.answers.q1} / Q2: ${state.answers.q2} / Q3: ${state.answers.q3} / Q4: ${state.answers.q4}

규칙:
1. 한국어로 답변하세요.
2. 사용자의 질문/의견에 맞춰 구체적이고 실무적인 조언을 제공하세요.
3. 사용자의 업종/직급 맥락을 반영하세요.
4. 마크다운이나 특수 형식을 쓰지 마세요.`,
            text
          );
          showQuickReplies(['다른 케이스 해보기']);
          enableInput();
        }
        break;
    }
  }

  // ---- Auto Resize Textarea ----
  function autoResize() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
  }

  // ---- Init ----
  async function startChat() {
    state.phase = 'profile-industry';
    updateProgress('profile');
    await botSay('안녕하세요! <strong>제 50기 한경협 Intensive MBA 과정</strong>에 오신 것을 환영합니다.\n업종, 직급, 경력을 입력하시면 AI가 다중 이해관계자가 등장하는 맞춤형 경영 케이스를 생성하고,\n4단계 분석(이해관계자 → 딜레마 → 의사결정 → 리스크 검증)을 통해 인사이트를 도출해드립니다.');
    await botSay('어떤 업종에서 일하고 계세요?', 500);
    setInputHint('예: IT, 제조업, 유통, 금융, 건설, 의료, 교육 등');
    showQuickReplies(['IT', '제조업', '유통', '금융', '건설', '서비스업', '의료', '교육']);
  }

  function init() {
    sendBtn.addEventListener('click', () => {
      const text = userInput.value.trim();
      if (text && !userInput.disabled) { hideQuickReplies(); handleUserMessage(text); }
    });

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = userInput.value.trim();
        if (text && !userInput.disabled) { hideQuickReplies(); handleUserMessage(text); }
      }
    });

    userInput.addEventListener('input', autoResize);

    floatingCaseBtn.addEventListener('click', openCasePanel);

    document.getElementById('close-panel').addEventListener('click', () => {
      casePanel.classList.remove('open');
      casePanelOverlay.classList.remove('visible');
    });
    casePanelOverlay.addEventListener('click', () => {
      casePanel.classList.remove('open');
      casePanelOverlay.classList.remove('visible');
    });

    startChat();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
