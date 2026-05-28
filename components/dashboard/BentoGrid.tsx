"use client";

import React, { useState } from "react";
import LeaderboardWidget from "./widgets/LeaderboardWidget";
import LootRoadWidget from "./widgets/LootRoadWidget";
import ClassGoalsWidget from "./widgets/ClassGoalsWidget";
import EfficiencyWidget from "./widgets/EfficiencyWidget";
import StudentModal from "./StudentModal";

export default function BentoGrid({ data, classId }: { data: any; classId: string | null }) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const selectedClassInfo = classId 
    ? data.classes.find((c: any) => c.id === classId) 
    : null;

  return (
    <>
      <div className="bento-grid">
        {/* Row 1 */}
        <div className="bento-widget col-span-2 row-span-2">
          <LeaderboardWidget 
            leaderboard={data.leaderboard} 
            isGlobal={!classId} 
            onStudentClick={setSelectedStudent}
          />
        </div>
        
        <div className="bento-widget col-span-2 row-span-2">
          <EfficiencyWidget leaderboard={data.leaderboard} />
        </div>

        {/* Row 2 */}
        <div className="bento-widget col-span-2 row-span-1" style={{ minHeight: "260px" }}>
          <LootRoadWidget 
            leaderboard={data.leaderboard} 
            classInfo={selectedClassInfo}
          />
        </div>

        <div className="bento-widget col-span-2 row-span-1" style={{ minHeight: "260px" }}>
          <ClassGoalsWidget classInfo={selectedClassInfo} leaderboard={data.leaderboard} kpi={data.kpi} />
        </div>
      </div>

      {selectedStudent && (
        <StudentModal 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
        />
      )}
    </>
  );
}
