package eu.civicrelay.nearbylab;

public final class LabTrialJournalTest {
    private static int checks;
    private static void require(boolean p, String label) {
        checks++;if(!p)throw new AssertionError(label);
    }
    private static void rejects(Runnable fn) {
        boolean failed=false;
        try {fn.run();} catch (IllegalArgumentException ex){failed=true;}
        require(failed,"Must reject invalid journal data");
    }
    public static void main(String[] args) {
        LabTrialJournal journal=new LabTrialJournal();
        String id="11111111-1111-4111-8111-111111111111";
        rejects(()->journal.record("not-uuid","ACK_RECEIVED",12));
        rejects(()->journal.record(id,"REAL_RESCUE",12));
        rejects(()->journal.record(id,"ACK_RECEIVED",-2));
        journal.record(id,"ACK_RECEIVED",27);
        require(journal.size()==1,"One event");
        require(journal.csv().contains(id+",ACK_RECEIVED,27"),"Result exported accurately");
        require(journal.csv().contains("NOT CERTIFIED"),"No certification claim");
        require(!journal.csv().contains("location"),"Does not collect location field");
        journal.record(id,"SEND_FAILED",-1);
        require(journal.csv().contains(id+",SEND_FAILED,\n"),"Unknown latency stays empty");
        for(int i=0;i<125;i++){
            String uid=String.format("%08x-0000-4000-8000-%012x",i+200,i+200);
            journal.record(uid,"EXPIRED",i);
        }
        require(journal.size()==120,"FIFO bounded");
        require(!journal.csv().contains(id+",ACK_RECEIVED"),"Oldest entry is dropped");
        journal.clear();
        require(journal.size()==0,"Consent revocation erases journal rows");
        require(journal.csv().split("\n").length==2,"Only heading after clear");
        System.out.println("PASS: "+checks+" local JVM journal checks; no field proof implied.");
    }
}
