import CreatePlaylistForm from "@/components/CreatePlaylistForm";

export default function Home() {
  return (
    <main className="min-h-full flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-gray-950 to-indigo-900/20 animate-gradient" />

        {/* Floating music notes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[15%] left-[10%] text-4xl opacity-10 animate-float-slow">&#9835;</div>
          <div className="absolute top-[25%] right-[15%] text-3xl opacity-8 animate-float-mid">&#9834;</div>
          <div className="absolute bottom-[30%] left-[20%] text-5xl opacity-6 animate-float-fast">&#9833;</div>
          <div className="absolute top-[60%] right-[10%] text-2xl opacity-10 animate-float-slow" style={{ animationDelay: "1s" }}>&#9839;</div>
        </div>

        <div className="relative z-10 w-full max-w-md mx-auto text-center">
          {/* 3D Logo Card */}
          <div className="mb-10 perspective-1000">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-2xl shadow-primary/30 transform-3d hover:rotate-y-12 hover:rotate-x-6 transition-transform duration-500">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Music Vote
            </h1>
            <p className="text-gray-400 mt-3 text-lg">
              밴드 곡을 투표로 선정하세요
            </p>
          </div>

          {/* Create Form */}
          <CreatePlaylistForm />
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 bg-surface/50">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold text-center mb-8 text-gray-200">이렇게 사용하세요</h2>
          <div className="space-y-6">
            {[
              { step: "1", title: "플레이리스트 만들기", desc: "밴드 이름이나 공연명으로 플레이리스트를 만드세요" },
              { step: "2", title: "YouTube 곡 추가", desc: "YouTube URL을 붙여넣으면 자동으로 곡 정보를 가져옵니다" },
              { step: "3", title: "링크 공유 & 투표", desc: "밴드 멤버에게 링크를 공유하면 바로 투표 시작!" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold group-hover:bg-primary/30 transition-colors">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-100">{item.title}</h3>
                  <p className="text-sm text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-6 text-center text-xs text-gray-600">
        Music Vote &mdash; 밴드를 위한 곡 투표 서비스
      </footer>
    </main>
  );
}
