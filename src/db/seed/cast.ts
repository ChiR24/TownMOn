// Who lives and works here: name pools, the staff list, and the three reference flats.
import type { Category } from "../../lib/complaints";
import type * as s from "../schema";
import { chance, pad, pick } from "./kit";

export const MEN = ["Aditya", "Amit", "Anand", "Abhijit", "Ashish", "Deepak", "Ganesh", "Harish", "Kiran", "Mahesh", "Manoj", "Nikhil", "Omkar", "Pankaj", "Prasad", "Rahul", "Rajesh", "Sachin", "Sameer", "Sandeep", "Shrikant", "Sunil", "Tushar", "Vikas", "Vinay", "Yogesh", "Imran", "Farhan", "Joseph", "Arjun", "Karthik", "Venkat", "Rohit", "Saurabh", "Hemant", "Girish"];
export const WOMEN = ["Aarti", "Anjali", "Ashwini", "Deepa", "Gauri", "Kavita", "Madhuri", "Manasi", "Neha", "Pooja", "Priya", "Rashmi", "Shweta", "Smita", "Sneha", "Sonali", "Supriya", "Varsha", "Vaishali", "Zainab", "Fatima", "Mary", "Lakshmi", "Divya", "Ketaki", "Mrunal"];
const SURNAMES = ["Patil", "Kulkarni", "Deshpande", "Joshi", "Jadhav", "Pawar", "Shinde", "Kale", "Gokhale", "Apte", "Bhide", "Kamat", "Naik", "Sawant", "Chavan", "Desai", "Mehta", "Shah", "Iyer", "Nair", "Reddy", "Gupta", "Sharma", "Verma", "Khan", "Shaikh", "Sayyad", "Dsouza", "Fernandes", "Agarwal", "Mishra", "Kapoor", "Bhosale", "Gaikwad", "More", "Mane", "Thakur", "Rane", "Ghosh", "Banerjee"];
export const person = () => `${pick(chance(0.45) ? WOMEN : MEN)} ${pick(SURNAMES)}`;

export const STAFF: { name: string; phone: string; role: (typeof s.role.enumValues)[number]; team?: Category }[] = [
  { name: "Rohan Patil", phone: "9800000010", role: "HELPDESK" },
  { name: "Sunita Deshmukh", phone: "9800000011", role: "ACCOUNTS" },
  { name: "Col. Vijay Rao (retd.)", phone: "9800000012", role: "COMMITTEE" },
  { name: "Anil Jadhav", phone: "9800000013", role: "MANAGER" },
  { name: "Ramesh Pawar", phone: "9800000014", role: "GUARD" },
  { name: "Sanjay More", phone: "9800000015", role: "GUARD" },
  ...(
    [
      ["Ganesh Shinde", "Plumbing"],
      ["Mahesh Kale", "Plumbing"],
      ["Suresh Gaikwad", "Plumbing"],
      ["Prakash Bhosale", "Electrical"],
      ["Ajay Salunkhe", "Electrical"],
      ["Kiran Mane (lift vendor)", "Lift"],
      ["Rahul Thorat (lift vendor)", "Lift"],
      ["Raju Waghmare (pump room)", "Water supply"],
      ["Lata Kamble", "Cleaning"],
      ["Savita Sathe", "Cleaning"],
      ["Manoj Gaikwad", "Cleaning"],
      ["Vikram Thorat (security)", "Security"],
      ["Santosh Jagtap", "Civil"],
      ["Nitin Kadam", "Civil"],
      ["Babu Shaikh", "Garden"],
      ["Amol (pest control)", "Pest control"],
    ] as const
  ).map(([name, team], i) => ({ name, phone: `98000001${pad(i)}`, role: "TECHNICIAN" as const, team })),
];

export type Method = "UPI" | "NEFT" | "IMPS" | "CHEQUE" | "GATEWAY";
export type Plan = { day: number; part?: number; amount?: number; method?: Method } | null;
type Demo = { primary: [string, string, "OWNER" | "TENANT"]; owner?: [string, string]; family?: [string, string][]; vpa?: string; method: Method; plan: (i: number) => Plan };

// The three reference flats, exact to the rupee.
export const DEMO: Record<string, Demo> = {
  "T07-1203": {
    primary: ["Neeraj Kulkarni", "9800000001", "OWNER"],
    family: [["Meera Kulkarni", "9800000004"]],
    vpa: "neeraj.kulkarni@okhdfcbank",
    method: "UPI",
    plan: (i) => (i < 3 ? { day: 3 } : { day: 1, method: "GATEWAY" }), // paid ₹7,475 this month, 0 days overdue
  },
  "T12-0408": {
    primary: ["Swati Joshi", "9800000002", "TENANT"],
    owner: ["Prakash Deshpande", "9600000408"],
    vpa: "swati.joshi@okicici",
    method: "NEFT",
    plan: (i) => (i === 0 ? { day: 8 } : null), // nothing paid since: ~47 days overdue, one open water-leak complaint
  },
  "T21-1601": {
    primary: ["Aamir Shaikh", "9800000003", "OWNER"],
    method: "IMPS",
    plan: (i) => (i < 2 ? { day: 6 } : i === 2 ? { day: 20, amount: 500_000 } : null), // ₹5,000 of ₹10,660: 18 days overdue
  },
};
