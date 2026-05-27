"use client";

import React, { useState } from "react";
import LeaderboardWidget from "./widgets/LeaderboardWidget";
import LootRoadWidget from "./widgets/LootRoadWidget";
import ClassGoalsWidget from "./widgets/ClassGoalsWidget";
import EfficiencyWidget from "./widgets/EfficiencyWidget";
import KPIStatsWidget from "./widgets/KPIStatsWidget";
import VelocityWidget from "./widgets/VelocityWidget";
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
        
        <div className="bento-widget col-span-2 row-span-1">
          <LootRoadWidget 
            leaderboard={data.leaderboard} 
            classInfo={selectedClassInfo}
          />
        </div>

        {/* Row 2 */}
        <div className="bento-widget col-span-1 row-span-1" style={{ background: "#f8f9fa", borderColor: "#228be6" }}>
          <KPIStatsWidget kpi={data.kpi} />
        </div>
        
        <div className="bento-widget col-span-1 row-span-1" style={{ background: "#fff5f5", borderColor: "#fa5252" }}>
          <VelocityWidget topStudent={data.topVelocity} />
        </div>

        {/* Row 3 */}
        <div className="bento-widget col-span-2 row-span-1">
          <EfficiencyWidget leaderboard={data.leaderboard} />
        </div>

        <div className="bento-widget col-span-2 row-span-1">
          <ClassGoalsWidget classInfo={selectedClassInfo} leaderboard={data.leaderboard} />
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
